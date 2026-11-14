import type {
  CreateOrderRequest,
  IOrderServiceStrategy,
  Order,
  Product,
} from "../types/order";
import {
  canonicalRequest,
  cents,
  decimal,
  estimate,
  newIdempotencyKey,
} from "../utils/order";
import { BasicOrderValidator } from "./BasicOrderValidator";
import type { PublicContext } from '../types/order';
import { EASTERN, PUBLIC_CONTRACT, PublicDay, easternDay, sameIntent } from './public-day';

// Isolated test server clock only. Production obtains this contract from Python.
export function mockPublicContext(now = Date.now()): PublicContext {
  const day = easternDay(now), target = Date.parse(day+'T00:00:00Z') + 86400000;
  let midnight = target;
  for (let i=0;i<3;i++) {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:EASTERN,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(midnight);
    const n=(name:string)=>Number(parts.find(p=>p.type===name)?.value);
    midnight += target-Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));
  }
  return {contract:PUBLIC_CONTRACT,timezone:EASTERN,business_day:day,server_now:new Date(now).toISOString(),expires_at:new Date(midnight).toISOString()};
}

export const demoProducts: Product[] = [
  {
    sku: "PRODUCT-001",
    name: "Everyday notebook",
    unit_price: "12.50",
    currency: "USD",
  },
  {
    sku: "PRODUCT-002",
    name: "Studio mug",
    unit_price: "18.00",
    currency: "USD",
  },
  {
    sku: "PRODUCT-003",
    name: "Canvas tote",
    unit_price: "24.00",
    currency: "USD",
  },
  {
    sku: "PRODUCT-004",
    name: "Brass pen",
    unit_price: "9.75",
    currency: "USD",
  },
  {
    sku: "PRODUCT-005",
    name: "Desk lamp",
    unit_price: "48.00",
    currency: "USD",
  },
];

// Retained for isolated component tests; production App always uses ApiOrderService.
export class MockOrderService implements IOrderServiceStrategy {
  private orders = new Map<string, Order>();
  private requests = new Map<string, {canonical:string;orderId:string}>();
  private day: PublicDay;
  constructor(private serverClock=Date.now,private monotonic=()=>performance.now()) { this.day=new PublicDay(monotonic); }
  private refreshContext() { this.day.accept(mockPublicContext(this.serverClock()),this.monotonic(),this.day.generation); }
  getPublicContext() { if (!this.day.current()) this.refreshContext(); return this.day.current(); }
  remainingPublicMs() { return this.day.remaining(); }
  invalidatePublicContext() { this.day.invalidate(); }
  async getProducts(): Promise<Product[]> {
    this.refreshContext();
    return structuredClone(demoProducts);
  }
  async getRecentOrders(): Promise<Order[]> {
    this.refreshContext();
    return structuredClone([...this.orders.values()].filter(o=>Date.parse(o.expires_at)>this.serverClock()&&o.business_day===this.day.current()?.business_day).reverse().slice(0,20));
  }
  async getOrder(id: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order || Date.parse(order.expires_at)<=this.serverClock()) throw new Error("Order not found.");
    return structuredClone(order);
  }
  async submitOrder(payload: CreateOrderRequest, key: string): Promise<Order> {
    this.refreshContext();
    if (!sameIntent(payload.public_context,this.day.current())) throw new Error('The saved public request expired. Start a new order.');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        key,
      )
    )
      throw new Error("Idempotency-Key must be a valid UUID.");
    const validation = new BasicOrderValidator().validate(
      payload,
      demoProducts,
    );
    if (!validation.valid)
      throw new Error(validation.errors.map((e) => e.message).join(" "));
    const request = canonicalRequest(payload);
    const canonical = JSON.stringify(request);
    const namespace = payload.public_context!.business_day+'#'+key;
    const prior = this.requests.get(namespace);
    const existing = prior ? this.orders.get(prior.orderId) : undefined;
    if (existing) {
      if (prior?.canonical !== canonical)
        throw new Error(
          "This idempotency key was already used for a different order request.",
        );
      return structuredClone(existing);
    }
    const now = new Date(this.serverClock()).toISOString();
    const order: Order = {
      order_id: newIdempotencyKey(),
      public_contract: PUBLIC_CONTRACT,
      business_day: payload.public_context!.business_day,
      expires_at: payload.public_context!.expires_at,
      customer_email: request.customer_email,
      status: request.simulate_failure ? "FAILED" : "CONFIRMED",
      failure_reason: request.simulate_failure
        ? "Processing failure requested by the local demonstration option."
        : null,
      created_at: now,
      updated_at: now,
      currency: "USD",
      total_amount: estimate(request, demoProducts),
      items: request.items.map((item) => {
        const product = demoProducts.find((p) => p.sku === item.product_sku)!;
        return {
          ...item,
          order_item_id: newIdempotencyKey(),
          product_name: product.name,
          unit_price: product.unit_price,
          line_total: decimal(cents(product.unit_price) * item.quantity),
        };
      }),
    };
    this.orders.set(order.order_id, order);
    this.requests.set(namespace, { canonical, orderId:order.order_id });
    return structuredClone(order);
  }
  async cancelOrder(id: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order || Date.parse(order.expires_at)<=this.serverClock()) throw new Error("Order not found.");
    if (order.status !== "CONFIRMED" && order.status !== "CANCELLED")
      throw new Error(
        `Cannot change an order from ${order.status} to CANCELLED.`,
      );
    if (order.status !== "CANCELLED") {
      order.status = "CANCELLED";
      order.updated_at = new Date(this.serverClock()).toISOString();
    }
    return structuredClone(order);
  }
}
