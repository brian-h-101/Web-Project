import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
  type RefObject,
} from 'react';
import type {
  CreateOrderRequest,
  IOrderServiceStrategy,
  IOrderValidationStrategy,
  Product,
  Submission,
  ValidationIssue,
} from '../types/order';
import { errorMessage, newIdempotencyKey, snapshotSubmission } from '../utils/order';
import { readSubmission, saveSubmission } from '../utils/session';
import { publicIntent, sameIntent } from '../strategies/public-day';
import { expiredContext, type OrderRecords, type ReadFeedback } from './useOrderHistory';
import type { OrderDay } from './usePublicDay';
export const blankRequest = (): CreateOrderRequest => ({
  customer_email: '',
  items: [],
  simulate_failure: false,
});
interface Props {
  service: IOrderServiceStrategy;
  validator: IOrderValidationStrategy;
  draft: CreateOrderRequest;
  setDraft: Dispatch<SetStateAction<CreateOrderRequest>>;
  products: Product[];
  productsRef: RefObject<Product[]>;
  reviewRef: RefObject<boolean>;
  loadCatalog: () => Promise<boolean>;
  day: OrderDay;
  records: OrderRecords;
  feedback: ReadFeedback & { setCancelling: Dispatch<SetStateAction<boolean>> };
  refreshHistory: () => Promise<void>;
  setIssues: Dispatch<SetStateAction<ValidationIssue[]>>;
  loading: boolean;
}
export function useOrderSubmission({
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
  feedback,
  refreshHistory,
  setIssues,
  loading,
}: Props) {
  const [key, setKey] = useState(() => readSubmission()?.key || newIdempotencyKey());
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(readSubmission),
    mutation = useRef(false);
  const { dayReady, publicContext, dayReadyRef, contextRef, epoch, mounted, invalidateDay } = day;
  const { directOrders, showOrder, setHistoryLoading, setHistoryError } = records;
  const { setError, setNotice, setLoading, setCancelling } = feedback;
  const locked = lastSubmission !== null;
  const savedValid =
    dayReady &&
    sameIntent(lastSubmission?.payload.public_context, publicContext) &&
    service.remainingPublicMs() > 0;
  // replay selects feedback for an explicit retry of saved intent, keeping its key/payload.
  // alreadyLocked is submit's handoff after catalog refresh; other callers acquire here.
  async function send(submission: Submission, replay: boolean, alreadyLocked = false) {
    if (mutation.current && !alreadyLocked) return;
    if (
      !dayReadyRef.current ||
      service.remainingPublicMs() <= 0 ||
      !sameIntent(submission.payload.public_context, service.getPublicContext())
    ) {
      mutation.current = false;
      setLoading(false);
      setError(
        'The saved request expired or cannot be verified. Start a new order after refreshing the public day.',
      );
      return;
    }
    mutation.current = true;
    // Public-day invalidation advances the epoch; late results must still match it
    // and the current business-day context before entering visible or saved state.
    const version = epoch.current;
    setLoading(true);
    setError(null);
    setIssues([]);
    setNotice(null);
    try {
      const result = await service.submitOrder(submission.payload, submission.key);
      if (
        !mounted.current ||
        version !== epoch.current ||
        result.business_day !== contextRef.current?.business_day ||
        service.remainingPublicMs() <= 0
      )
        return;
      directOrders.current.set(result.order_id, result);
      showOrder(result);
      const completed = { ...submission, orderId: result.order_id };
      setLastSubmission(completed);
      saveSubmission(completed);
      setNotice(
        replay
          ? 'Original request replayed. Its current order result is shown.'
          : 'Order received. Its processing result is shown in Order details.',
      );
      await refreshHistory();
    } catch (e) {
      if (mounted.current && version === epoch.current) {
        if (expiredContext(e)) {
          invalidateDay();
          setHistoryLoading(false);
          setHistoryError('The public day changed. Reload the catalog.');
        }
        setError(errorMessage(e));
      }
    } finally {
      mutation.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validator.validate(draft, products);
    setIssues(result.errors);
    if (
      !result.valid ||
      mutation.current ||
      loading ||
      locked ||
      reviewRef.current ||
      !dayReadyRef.current ||
      service.remainingPublicMs() <= 0
    )
      return;
    // Own the mutation lock before awaiting the catalog. Guarded exits release it
    // here; a successful handoff lets send's finally release the same lock.
    mutation.current = true;
    setLoading(true);
    const available = await loadCatalog();
    if (!mounted.current) {
      mutation.current = false;
      return;
    }
    setLoading(false);
    if (
      !available ||
      reviewRef.current ||
      !contextRef.current ||
      service.remainingPublicMs() <= 0
    ) {
      mutation.current = false;
      return;
    }
    const submission = snapshotSubmission(key, {
      ...draft,
      public_context: publicIntent(contextRef.current),
      items: draft.items.map((item) => {
        const revision = productsRef.current.find(
          (product) => product.sku === item.product_sku,
        )?.revision;
        return { ...item, ...(revision === undefined ? {} : { catalog_revision: revision }) };
      }),
    });
    // Persist the immutable day-bound request intent, not an authentication/session identity.
    saveSubmission(submission);
    setLastSubmission(submission);
    void send(submission, false, true); // New-request feedback; retain submit's existing lock.
  }
  function startNew() {
    saveSubmission(null);
    setDraft(blankRequest());
    setKey(newIdempotencyKey());
    setLastSubmission(null);
    setIssues([]);
    setError(null);
    setNotice(null);
    showOrder(null);
  }

  async function cancel(id: string) {
    if (mutation.current || !dayReadyRef.current || service.remainingPublicMs() <= 0) return;
    mutation.current = true;
    const version = epoch.current;
    setCancelling(true);
    setError(null);
    setNotice(null);
    try {
      const result = await service.cancelOrder(id);
      if (
        !mounted.current ||
        version !== epoch.current ||
        result.business_day !== contextRef.current?.business_day
      )
        return;
      directOrders.current.set(result.order_id, result);
      showOrder(result);
      setNotice('Order cancelled. The order record is preserved.');
      await refreshHistory();
    } catch (e) {
      if (mounted.current && version === epoch.current) {
        if (expiredContext(e)) {
          invalidateDay();
          setHistoryLoading(false);
          setHistoryError('The public day changed. Reload the catalog.');
        }
        setError(errorMessage(e));
      }
    } finally {
      mutation.current = false;
      if (mounted.current) setCancelling(false);
    }
  }

  return { key, lastSubmission, locked, savedValid, send, submit, startNew, cancel };
}
