// Minimal structural DTOs required by public-day validation. No application/UI imports.
export interface PublicIntent {
  contract: 'public-orders-v1';
  business_day: string;
  expires_at: string;
}
export interface PublicContext extends PublicIntent {
  timezone: 'America/New_York';
  server_now: string;
}
export interface PublicOrder {
  order_id: string;
  customer_email: string;
  public_contract: 'public-orders-v1';
  business_day: string;
  expires_at: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  items: unknown[];
}
