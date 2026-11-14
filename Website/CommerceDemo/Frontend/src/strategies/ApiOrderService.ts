import type {
  CreateOrderRequest,
  IOrderServiceStrategy,
  Order,
  Product,
  ValidationIssue,
} from "../types/order";
import { PublicDay, publicIntent, sameIntent } from './public-day';
import { boundedRead } from './read-policy';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "api_error",
    public details: ValidationIssue[] = [],
  ) {
    super(message);
  }
}

export class ApiOrderService implements IOrderServiceStrategy {
  private day: PublicDay;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args), private monotonic = () => performance.now()) { this.day = new PublicDay(monotonic); }
  getPublicContext() { return this.day.current(); }
  remainingPublicMs() { return this.day.remaining(); }
  invalidatePublicContext() { this.day.invalidate(); }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response;
    const started = this.monotonic(), generation = this.day.generation;
    try {
      const once = (signal: AbortSignal) => this.fetcher(`/api${path}`, { ...options, signal, cache: 'no-store', credentials: 'omit', headers: { ...options?.headers } });
      const readOnce = async (signal: AbortSignal) => {
        try {
          const result = await once(signal);
          if (!result.ok) return result;
          // Include successful response-body transport in the read deadline and
          // network retry budget. Invalid JSON/schema is still a hard failure.
          const body = await result.text();
          return new Response(body, { status: result.status, statusText: result.statusText, headers: result.headers });
        } catch (error) { if (signal.aborted) throw signal.reason; throw error; }
      };
      response = !options?.method || options.method === 'GET'
        ? await boundedRead(readOnce, options?.signal || undefined)
        : await once(options?.signal || AbortSignal.timeout(15000));
    } catch {
      options?.signal?.throwIfAborted();
      throw new ApiError(
        "Could not reach the demonstration API. Check the connection, then retry the original request.",
        0,
        "network_error",
      );
    }
    let body;
    try {
      body = await response.json();
    } catch {
      options?.signal?.throwIfAborted();
      throw new ApiError(
        "The API returned an unreadable response. Reconcile its outcome before retrying the unchanged saved request within its original public day.",
        response.status,
        "invalid_response",
      );
    }
    options?.signal?.throwIfAborted();
    if (!response.ok) {
      const details: ValidationIssue[] = Array.isArray(body?.error?.details)
        ? body.error.details
        : [];
      const message =
        body?.error?.message ?? `The request failed (${response.status}).`;
      throw new ApiError(
        [message, ...details.map((d) => d.message)].join(" "),
        response.status,
        body?.error?.code,
        details,
      );
    }
    if (generation !== this.day.generation) throw new DOMException('A response from before public-day revalidation was canceled.', 'AbortError');
    try { this.day.accept(body.public_context, started, generation); }
    catch (error) { if (error instanceof DOMException) throw error; throw new ApiError(error instanceof Error ? error.message : 'Public order policy unavailable.', 502, 'invalid_public_context'); }
    return body as T;
  }
  health(): Promise<{ status: string }> { return this.request('/health'); }
  submitOrder(
    request: CreateOrderRequest,
    idempotencyKey: string,
  ): Promise<Order> {
    if (!sameIntent(request.public_context,this.day.current()) || this.day.remaining() <= 0) return Promise.reject(new ApiError('The saved request is not valid for the current public day. Start a new order.',409,'public_context_expired'));
    return this.request<Order>("/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(request),
    }).then(order => this.day.validateOrder(order));
  }
  getOrder(id: string, signal?: AbortSignal): Promise<Order> {
    return this.request<Order>(`/orders/${encodeURIComponent(id)}`, { signal }).then(order => this.day.validateOrder(order));
  }
  async getRecentOrders(signal?: AbortSignal): Promise<Order[]> {
    const body = await this.request<{ orders: Order[] }>("/orders", { signal });
    if (!Array.isArray(body.orders)) throw new ApiError('Order history could not be verified. Retry history.', 502, 'invalid_history');
    return body.orders.map(order => this.day.validateOrder(order));
  }
  async getProducts(signal?: AbortSignal): Promise<Product[]> {
    const body = await this.request<{ products: Product[] }>("/products", { signal });
    if (!Array.isArray(body.products) || body.products.some(p => !p || typeof p.sku !== 'string' || typeof p.name !== 'string' || p.currency !== 'USD' || !/^(?:0|[1-9][0-9]{0,5})\.[0-9]{2}$/.test(p.unit_price) || Number(p.unit_price) <= 0 || (p.revision !== undefined && (!Number.isSafeInteger(p.revision) || p.revision < 1)))) throw new ApiError('The catalog response could not be verified. Reload the catalog.', 502, 'invalid_catalog');
    return body.products;
  }
  cancelOrder(id: string): Promise<Order> {
    const context = this.day.current();
    if (!context || this.day.remaining() <= 0) return Promise.reject(new ApiError('Refresh the current public day before cancelling.',409,'public_context_expired'));
    return this.request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_context: publicIntent(context) }),
    }).then(order => this.day.validateOrder(order));
  }
}
