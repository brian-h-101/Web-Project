import { useOrderSubmission, blankRequest } from '../hooks/useOrderSubmission';
import { useOrderRecords, useOrderHistory } from '../hooks/useOrderHistory';
import { usePublicDay, usePublicDayEvents } from '../hooks/usePublicDay';
import { OrderForm } from './OrderForm';
import { OrderHistory } from './OrderHistory';
import { useCallback, useRef, useState } from 'react';
import type {
  CreateOrderRequest,
  IOrderServiceStrategy,
  IOrderValidationStrategy,
  Product,
  ValidationIssue,
} from '../types/order';
import { errorMessage } from '../utils/order';
import { OrderDisplay } from './OrderDisplay';

interface Props {
  service: IOrderServiceStrategy;
  validator: IOrderValidationStrategy;
  mock?: boolean;
  onCatalogStateChange?: (state: CatalogState) => void;
}
export type CatalogState = 'loading' | 'ready' | 'unavailable';

export function OrderContainer({ service, validator, mock = false, onCatalogStateChange }: Props) {
  const [draft, setDraft] = useState<CreateOrderRequest>(blankRequest);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [lookup, setLookup] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [catalogReview, setCatalogReview] = useState(false);
  const productsRef = useRef<Product[]>([]);
  const reviewRef = useRef(false);
  const selectedRef = useRef('');
  const catalogRequest = useRef<AbortController | null>(null);
  const records = useOrderRecords();
  const { history, order, historyError, historyLoading, setHistoryError, setHistoryLoading } =
    records;
  const day = usePublicDay(service, catalogRequest, records);
  const { refreshHistory, selectOrder } = useOrderHistory(service, day, records, {
    setError,
    setNotice,
    setLoading,
  });
  const { dayReady, mounted, adoptDay } = day;

  const loadCatalog = useCallback(async () => {
    catalogRequest.current?.abort();
    const controller = new AbortController();
    catalogRequest.current = controller;
    setCatalogLoading(true);
    onCatalogStateChange?.('loading');
    try {
      const result = await service.getProducts(controller.signal);
      if (controller.signal.aborted || !mounted.current) return false;
      adoptDay();
      const prior = productsRef.current;
      const changed = prior.length > 0 && JSON.stringify(prior) !== JSON.stringify(result);
      if (changed) {
        reviewRef.current = true;
        setCatalogReview(true);
      }
      const initial = prior.length === 0 && !selectedRef.current;
      if (initial && !reviewRef.current) selectedRef.current = result[0]?.sku ?? '';
      else if (!result.some((product) => product.sku === selectedRef.current))
        selectedRef.current = '';
      productsRef.current = result;
      setProducts(result);
      setSelectedSku(selectedRef.current);
      setCatalogError(null);
      onCatalogStateChange?.('ready');
      return true;
    } catch (e) {
      if (controller.signal.aborted || !mounted.current) return false;
      setCatalogError(errorMessage(e));
      onCatalogStateChange?.('unavailable');
      return false;
    } finally {
      if (!controller.signal.aborted && mounted.current) setCatalogLoading(false);
    }
  }, [service, onCatalogStateChange, adoptDay]);
  const loadCurrentDay = useCallback(async () => {
    const pending = loadCatalog(),
      expected = catalogRequest.current;
    const ready = await pending;
    if (!mounted.current || expected !== catalogRequest.current || expected?.signal.aborted) return;
    if (ready) await refreshHistory();
    else {
      setHistoryLoading(false);
      setHistoryError(
        'The current public day is unavailable. Reload the catalog before loading history.',
      );
    }
  }, [loadCatalog, refreshHistory]);
  usePublicDayEvents(service, day, loadCurrentDay);
  const { key, lastSubmission, locked, savedValid, send, submit, startNew, cancel } =
    useOrderSubmission({
      service,
      validator,
      draft,
      setDraft,
      products,
      productsRef,
      reviewRef,
      loadCatalog,
      day,
      records,
      feedback: { setError, setNotice, setLoading, setCancelling },
      refreshHistory,
      setIssues,
      loading,
    });

  function addItem() {
    if (!selectedSku || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setIssues([
        {
          field: 'items',
          message: 'Select a product and a whole quantity between 1 and 99.',
        },
      ]);
      return;
    }
    const existing = draft.items.find((item) => item.product_sku === selectedSku);
    if ((existing?.quantity ?? 0) + quantity > 99 || (!existing && draft.items.length >= 20)) {
      setIssues([
        {
          field: 'items',
          message: 'Use at most 20 items and 99 units of each product.',
        },
      ]);
      return;
    }
    setDraft({
      ...draft,
      items: existing
        ? draft.items.map((item) =>
            item.product_sku === selectedSku
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...draft.items, { product_sku: selectedSku, quantity }],
    });
    setIssues([]);
    setQuantity(1);
  }

  const acceptCatalog = () => {
    reviewRef.current = false;
    setCatalogReview(false);
  };
  const chooseSku = (sku: string) => {
    selectedRef.current = sku;
    setSelectedSku(sku);
  };
  return (
    <div className="app-shell">
      <main>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ORDER WORKSPACE</span>
            </div>
            <button
              className="button button-light"
              onClick={startNew}
              disabled={loading || cancelling}
            >
              ＋ New order
            </button>
          </div>
          {mock && (
            <div className="notice">
              Mock mode is active. Orders are stored in this browser session only.
            </div>
          )}
          {notice && (
            <div role="status" className="notice notice-success">
              ✓ {notice}
            </div>
          )}
          <div className="order-grid">
            <OrderForm
              {...{
                catalogError,
                loadCurrentDay,
                catalogLoading,
                catalogReview,
                draft,
                products,
                acceptCatalog,
                locked,
                loading,
                dayReady,
                setDraft,
                issues,
                selectedSku,
                chooseSku,
                quantity,
                setQuantity,
                addItem,
                submit,
                lastSubmission,
                cancelling,
                savedValid,
                send,
              }}
              keyValue={key}
            />
            <OrderDisplay
              order={order}
              loading={loading}
              error={error}
              onCancel={(id) => void cancel(id)}
              cancelling={cancelling}
              requestKey={
                order?.order_id === lastSubmission?.orderId ? lastSubmission?.key : undefined
              }
            />
          </div>
          <OrderHistory
            {...{
              historyLoading,
              historyError,
              history,
              refreshHistory,
              lookup,
              setLookup,
              selectOrder,
              loading,
              cancelling,
              dayReady,
            }}
          />
          <footer>
            <span>PRODUCT ORDERING PLATFORM</span>
            <span>Temporary sample orders · No payments are collected</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
