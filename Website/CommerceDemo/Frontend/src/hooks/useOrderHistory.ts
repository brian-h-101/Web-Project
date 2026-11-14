import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { IOrderServiceStrategy, Order } from '../types/order';
import type { OrderDay } from './usePublicDay';
import { errorMessage } from '../utils/order';
import { ApiError } from '../strategies/ApiOrderService';
export const expiredContext = (error: unknown) =>
  error instanceof ApiError &&
  ['public_day_changed', 'public_context_expired', 'public_contract_required'].includes(error.code);
export interface ReadFeedback {
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}
export function useOrderRecords() {
  const [history, setHistory] = useState<Order[]>([]),
    [order, setOrder] = useState<Order | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null),
    [historyLoading, setHistoryLoading] = useState(true);
  const selectedOrder = useRef<Order | null>(null),
    directOrders = useRef(new Map<string, Order>());
  const historyRequest = useRef<AbortController | null>(null),
    lookupRequest = useRef<AbortController | null>(null);
  const showOrder = useCallback((value: Order | null) => {
    selectedOrder.current = value;
    setOrder(value);
  }, []);
  return {
    history,
    setHistory,
    order,
    historyError,
    setHistoryError,
    historyLoading,
    setHistoryLoading,
    selectedOrder,
    directOrders,
    historyRequest,
    lookupRequest,
    showOrder,
  };
}
export type OrderRecords = ReturnType<typeof useOrderRecords>;
export function useOrderHistory(
  service: IOrderServiceStrategy,
  day: OrderDay,
  records: OrderRecords,
  feedback: ReadFeedback,
) {
  const { dayReadyRef, refreshDayRef, epoch, mounted, adoptDay, invalidateDay, contextRef } = day;
  const {
    historyRequest,
    lookupRequest,
    setHistoryLoading,
    directOrders,
    selectedOrder,
    showOrder,
    setHistory,
    setHistoryError,
  } = records;
  const { setError, setNotice, setLoading } = feedback;
  const refreshHistory = useCallback(async () => {
    if (!dayReadyRef.current || service.remainingPublicMs() <= 0) {
      await refreshDayRef.current();
      return;
    }
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    const version = epoch.current;
    setHistoryLoading(true);
    try {
      const result = await service.getRecentOrders(controller.signal);
      if (controller.signal.aborted || !mounted.current || version !== epoch.current) return;
      const context = adoptDay();
      const merged = new Map(result.map((item) => [item.order_id, item]));
      for (const [id, direct] of directOrders.current) {
        if (direct.business_day !== context.business_day) {
          directOrders.current.delete(id);
          continue;
        }
        const indexed = merged.get(id);
        if (
          !indexed ||
          indexed.updated_at < direct.updated_at ||
          (indexed.updated_at === direct.updated_at && direct.status === 'CANCELLED')
        )
          merged.set(id, direct);
        else directOrders.current.delete(id);
      }
      const selected = selectedOrder.current;
      if (selected) {
        try {
          const current = await service.getOrder(selected.order_id, controller.signal);
          if (
            !controller.signal.aborted &&
            mounted.current &&
            version === epoch.current &&
            selectedOrder.current?.order_id === selected.order_id
          ) {
            showOrder(current);
            merged.set(current.order_id, current);
            if (directOrders.current.has(current.order_id))
              directOrders.current.set(current.order_id, current);
          }
        } catch (e) {
          if (!controller.signal.aborted && mounted.current && version === epoch.current) {
            showOrder(null);
            setError(errorMessage(e));
            if (e instanceof ApiError && e.status === 404) {
              merged.delete(selected.order_id);
              directOrders.current.delete(selected.order_id);
            } else throw e;
          }
        }
      }
      if (
        controller.signal.aborted ||
        !mounted.current ||
        version !== epoch.current ||
        context.business_day !== contextRef.current?.business_day
      )
        return;
      setHistory(
        [...merged.values()]
          .sort(
            (a, b) =>
              b.created_at.localeCompare(a.created_at) || b.order_id.localeCompare(a.order_id),
          )
          .slice(0, 20),
      );
      setHistoryError(null);
    } catch (e) {
      if (controller.signal.aborted || !mounted.current || version !== epoch.current) return;
      if (expiredContext(e)) {
        invalidateDay();
        setHistoryLoading(false);
      }
      setHistoryError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted && mounted.current) setHistoryLoading(false);
    }
  }, [service, adoptDay, showOrder, invalidateDay]);
  async function selectOrder(id: string) {
    if (!dayReadyRef.current || service.remainingPublicMs() <= 0) {
      await refreshDayRef.current();
      return;
    }
    lookupRequest.current?.abort();
    const controller = new AbortController();
    lookupRequest.current = controller;
    const version = epoch.current;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await service.getOrder(id.trim(), controller.signal);
      if (!controller.signal.aborted && mounted.current && version === epoch.current) {
        adoptDay();
        showOrder(result);
      }
    } catch (e) {
      if (controller.signal.aborted || !mounted.current || version !== epoch.current) return;
      showOrder(null);
      setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    }
  }
  return { refreshHistory, selectOrder };
}
