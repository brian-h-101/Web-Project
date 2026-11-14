import type { CreateOrderRequest, Product, Submission } from "../types/order";

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
export function snapshotSubmission(
  key: string,
  payload: CreateOrderRequest,
): Submission {
  if (!payload.public_context) throw new Error('Verify the current public day before saving a request.');
  return {
    version: 'public-orders-v1',
    key,
    payload: { ...payload, public_context: { ...payload.public_context }, items: payload.items.map((item) => ({ ...item })) },
  };
}
export function canonicalRequest(
  request: CreateOrderRequest,
): CreateOrderRequest {
  const quantities = new Map<string, number>();
  request.items.forEach((item) => {
    const sku = item.product_sku.trim().toUpperCase();
    quantities.set(sku, (quantities.get(sku) ?? 0) + item.quantity);
  });
  return {
    ...(request.public_context ? { public_context: { ...request.public_context } } : {}),
    customer_email: request.customer_email.trim().toLowerCase(),
    items: [...quantities]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([product_sku, quantity]) => ({ product_sku, quantity })),
    simulate_failure: request.simulate_failure,
  };
}
export function cents(amount: string): number {
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function decimal(centsValue: number): string {
  return (centsValue / 100).toFixed(2);
}
export function money(amount: string, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents(amount) / 100,
  );
}
export function estimate(
  request: CreateOrderRequest,
  products: Product[],
): string {
  return decimal(
    request.items.reduce(
      (sum, item) =>
        sum +
        cents(
          products.find((p) => p.sku === item.product_sku)?.unit_price ?? "0",
        ) *
          item.quantity,
      0,
    ),
  );
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}
export function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
