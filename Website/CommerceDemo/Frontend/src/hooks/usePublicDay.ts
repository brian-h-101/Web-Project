import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import type { IOrderServiceStrategy, Order, PublicContext } from '../types/order';
export interface DayRecords {
  directOrders: RefObject<Map<string, Order>>;
  showOrder: (value: Order | null) => void;
  setHistory: Dispatch<SetStateAction<Order[]>>;
  setHistoryError: Dispatch<SetStateAction<string | null>>;
  setHistoryLoading: Dispatch<SetStateAction<boolean>>;
  lookupRequest: RefObject<AbortController | null>;
  historyRequest: RefObject<AbortController | null>;
}
export function usePublicDay(
  service: IOrderServiceStrategy,
  catalogRequest: RefObject<AbortController | null>,
  records: DayRecords,
) {
  const {
    directOrders,
    showOrder,
    setHistory,
    setHistoryError,
    setHistoryLoading,
    lookupRequest,
    historyRequest,
  } = records;
  const [publicContext, setPublicContext] = useState<PublicContext | null>(null),
    [dayReady, setDayReady] = useState(false);
  const dayReadyRef = useRef(false),
    contextRef = useRef<PublicContext | null>(null),
    epoch = useRef(0),
    mounted = useRef(true);
  const refreshDayRef = useRef<() => Promise<void>>(async () => {});
  const adoptDay = useCallback(() => {
    const value = service.getPublicContext();
    if (!value || service.remainingPublicMs() <= 0)
      throw new Error('The current public day could not be verified. Reload the catalog.');
    if (contextRef.current && contextRef.current.business_day !== value.business_day) {
      epoch.current++;
      directOrders.current.clear();
      setHistory([]);
      showOrder(null);
      lookupRequest.current?.abort();
    }
    contextRef.current = value;
    dayReadyRef.current = true;
    setDayReady(true);
    setPublicContext(value);
    return value;
  }, [service, showOrder]);
  const invalidateDay = useCallback(() => {
    epoch.current++;
    dayReadyRef.current = false;
    contextRef.current = null;
    service.invalidatePublicContext();
    catalogRequest.current?.abort();
    historyRequest.current?.abort();
    lookupRequest.current?.abort();
    directOrders.current.clear();
    showOrder(null);
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    setDayReady(false);
    setPublicContext(null);
  }, [service, showOrder]);

  return {
    publicContext,
    dayReady,
    dayReadyRef,
    contextRef,
    epoch,
    mounted,
    refreshDayRef,
    adoptDay,
    invalidateDay,
    catalogRequest,
    historyRequest,
    lookupRequest,
  };
}
export type OrderDay = ReturnType<typeof usePublicDay>;
export function usePublicDayEvents(
  service: IOrderServiceStrategy,
  day: OrderDay,
  loadCurrentDay: () => Promise<void>,
) {
  const {
    publicContext,
    dayReady,
    epoch,
    mounted,
    refreshDayRef,
    invalidateDay,
    catalogRequest,
    historyRequest,
    lookupRequest,
  } = day;
  refreshDayRef.current = async () => {
    invalidateDay();
    await loadCurrentDay();
  };
  useEffect(() => {
    mounted.current = true;
    // Catalog gets first use of the bounded API/Lambda capacity. No health probe.
    void loadCurrentDay();
    let resume: ReturnType<typeof setTimeout>;
    const focus = () => {
      if (document.visibilityState !== 'visible') return;
      invalidateDay();
      clearTimeout(resume);
      resume = setTimeout(() => void loadCurrentDay(), 200);
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      mounted.current = false;
      epoch.current++;
      clearTimeout(resume);
      service.invalidatePublicContext();
      catalogRequest.current?.abort();
      historyRequest.current?.abort();
      lookupRequest.current?.abort();
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [service, loadCurrentDay, invalidateDay]);
  useEffect(() => {
    if (!dayReady || !publicContext) return;
    const timer = setTimeout(
      () => void refreshDayRef.current(),
      Math.max(0, service.remainingPublicMs()) + 1,
    );
    return () => clearTimeout(timer);
  }, [dayReady, publicContext, service]);
}
