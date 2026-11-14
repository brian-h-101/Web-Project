export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
import type { PublicIntent, PublicContext } from '@portfolio/browser-contracts';
export type { PublicIntent, PublicContext } from '@portfolio/browser-contracts';
export interface Product {
  revision?: number;
  sku: string;
  name: string;
  unit_price: string;
  currency: string;
}
export interface OrderRequestItem {
  catalog_revision?: number;
  product_sku: string;
  quantity: number;
}
export interface CreateOrderRequest {
  public_context?: PublicIntent;
  customer_email: string;
  items: OrderRequestItem[];
  simulate_failure: boolean;
}
export interface OrderItem extends OrderRequestItem {
  order_item_id: string;
  product_name: string;
  unit_price: string;
  line_total: string;
}
export interface Order {
  order_id: string;
  customer_email: string;
  public_contract: 'public-orders-v1';
  business_day: string;
  expires_at: string;
  status: OrderStatus;
  items: OrderItem[];
  total_amount: string;
  currency: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}
export interface ValidationIssue {
  field: string;
  message: string;
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}
export interface IOrderValidationStrategy {
  validate(request: CreateOrderRequest, products: Product[]): ValidationResult;
}
export interface IOrderServiceStrategy {
  getPublicContext(): PublicContext | null;
  remainingPublicMs(): number;
  invalidatePublicContext(): void;
  submitOrder(request: CreateOrderRequest, idempotencyKey: string): Promise<Order>;
  getOrder(id: string, signal?: AbortSignal): Promise<Order>;
  getRecentOrders(signal?: AbortSignal): Promise<Order[]>;
  getProducts(signal?: AbortSignal): Promise<Product[]>;
  cancelOrder(id: string): Promise<Order>;
}
export interface IOrderDisplayProps {
  requestKey?: string;
  order: Order | null;
  loading: boolean;
  error: string | null;
  onCancel: (id: string) => void;
  cancelling: boolean;
}
export interface Submission {
  version: 'public-orders-v1';
  orderId?: string;
  key: string;
  payload: CreateOrderRequest & { public_context: PublicIntent };
}
