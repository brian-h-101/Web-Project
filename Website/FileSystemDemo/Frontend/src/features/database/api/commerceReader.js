import { PublicDay, easternDay, boundedRead } from '@portfolio/browser-contracts';

export const orderId = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fields = [
  'order_id',
  'customer_email',
  'status',
  'total_amount',
  'currency',
  'failure_reason',
  'created_at',
  'updated_at',
  'business_day',
  'public_contract',
  'expires_at',
  'items',
];
const itemFields = [
  'product_sku',
  'order_item_id',
  'product_name',
  'unit_price',
  'line_total',
  'quantity',
];
const money = (value) =>
  typeof value === 'string' && /^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/.test(value);
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((k) => keys.includes(k)) &&
  keys.every((k) => k in value);
const invalid = () => new Error('The public application record could not be verified.');
export function mergeOrder(old, next) {
  if (!old || old.order_id !== next.order_id) return next;
  if (old.status === 'CANCELLED' && next.status !== 'CANCELLED') return old;
  return Date.parse(old.updated_at) > Date.parse(next.updated_at) ? old : next;
}

// A separate, GET-only boundary. No session, token, mutation service or generic URL API.
export class CommerceReader {
  constructor(fetcher = (...args) => fetch(...args), now = () => performance.now()) {
    this.fetcher = fetcher;
    this.now = now;
    this.day = new PublicDay(now);
  }
  remaining() {
    return this.day.remaining();
  }
  invalidate() {
    this.day.invalidate();
  }
  isCurrent(record) {
    try {
      this.day.validateOrder(record);
      return true;
    } catch {
      return false;
    }
  }
  record(raw) {
    if (
      !exact(raw, fields) ||
      !orderId(raw.order_id) ||
      !money(raw.total_amount) ||
      raw.currency !== 'USD' ||
      (raw.failure_reason !== null && typeof raw.failure_reason !== 'string') ||
      !Number.isFinite(Date.parse(raw.created_at)) ||
      !Number.isFinite(Date.parse(raw.updated_at)) ||
      easternDay(Date.parse(raw.created_at)) !== raw.business_day ||
      Date.parse(raw.updated_at) < Date.parse(raw.created_at) ||
      Date.parse(raw.updated_at) >= Date.parse(raw.expires_at) ||
      !Array.isArray(raw.items) ||
      raw.items.length > 100
    )
      throw invalid();
    this.day.validateOrder(raw);
    for (const item of raw.items)
      if (
        !exact(item, itemFields) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        !money(item.unit_price) ||
        !money(item.line_total) ||
        !['product_sku', 'order_item_id', 'product_name'].every(
          (k) => typeof item[k] === 'string' && item[k].length > 0 && item[k].length <= 200,
        )
      )
        throw invalid();
    return structuredClone(raw);
  }
  async #read(path, signal) {
    if (signal !== undefined && !(signal instanceof AbortSignal))
      throw new Error('Only an AbortSignal is accepted by this reader.');
    const started = this.now(),
      generation = this.day.generation;
    const response = await boundedRead(async (requestSignal) => {
      try {
        const result = await this.fetcher(path, {
          method: 'GET',
          signal: requestSignal,
          cache: 'no-store',
          credentials: 'omit',
        });
        if (!result.ok) return result;
        const text = await result.text(); // Body interruption shares the single bounded retry budget.
        return new Response(text, { status: result.status, headers: result.headers });
      } catch (error) {
        if (requestSignal.aborted) throw requestSignal.reason;
        throw error;
      }
    }, signal);
    signal?.throwIfAborted();
    if (!response.ok)
      throw Object.assign(
        new Error('Public orders could not be read (HTTP ' + response.status + ').'),
        { status: response.status },
      );
    const body = await response.json();
    signal?.throwIfAborted();
    this.day.accept(body.public_context, started, generation);
    return body;
  }
  async list(signal) {
    const body = await this.#read('/api/orders?limit=20', signal);
    if (
      !exact(body, ['orders', 'public_context']) ||
      !Array.isArray(body.orders) ||
      body.orders.length > 20
    )
      throw invalid();
    const rows = body.orders.map((order) => this.record(order));
    const unique = new Map();
    for (const order of rows)
      unique.set(order.order_id, mergeOrder(unique.get(order.order_id), order));
    return [...unique.values()];
  }
  async detail(id, signal) {
    if (!orderId(id)) throw new Error('A valid public order identifier is required.');
    const { public_context, ...record } = await this.#read(
      '/api/orders/' + encodeURIComponent(id),
      signal,
    );
    if (record.order_id !== id) throw invalid();
    return this.record(record);
  }
}
