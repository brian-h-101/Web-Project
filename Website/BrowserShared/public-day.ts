import type { PublicContext, PublicIntent, PublicOrder } from './contracts';
export const PUBLIC_CONTRACT = 'public-orders-v1' as const;
export const EASTERN = 'America/New_York' as const;
export function easternDay(epoch: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(epoch);
  const field = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}
export function publicIntent(context: PublicContext): PublicIntent {
  return {
    contract: PUBLIC_CONTRACT,
    business_day: context.business_day,
    expires_at: context.expires_at,
  };
}
export function sameIntent(a: PublicIntent | undefined, b: PublicContext | null): boolean {
  return (
    !!a &&
    !!b &&
    a.contract === b.contract &&
    a.business_day === b.business_day &&
    a.expires_at === b.expires_at
  );
}
// Server-relative monotonic validity; the browser wall clock never grants access.
export class PublicDay {
  generation = 0;
  private context: PublicContext | null = null;
  private deadline = 0;
  constructor(private now: () => number = () => performance.now()) {}
  invalidate(): void {
    this.generation++;
    this.context = null;
    this.deadline = 0;
  }
  remaining(): number {
    return this.context ? Math.max(0, this.deadline - this.now()) : 0;
  }
  current(): PublicContext | null {
    return this.context ? { ...this.context } : null;
  }
  accept(raw: PublicContext, started: number, generation: number): void {
    const server = Date.parse(raw?.server_now),
      expiry = Date.parse(raw?.expires_at);
    const next = /^\d{4}-\d{2}-\d{2}$/.test(raw?.business_day || '')
      ? new Date(Date.parse(raw.business_day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
      : '';
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: EASTERN,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(Number.isFinite(expiry) ? expiry : 0),
    );
    if (generation !== this.generation)
      throw new DOMException('An old public-day response was canceled.', 'AbortError');
    if (
      raw?.contract !== PUBLIC_CONTRACT ||
      raw.timezone !== EASTERN ||
      !Number.isFinite(server) ||
      !Number.isFinite(expiry) ||
      easternDay(server) !== raw.business_day ||
      easternDay(expiry) !== next ||
      hour !== 0 ||
      expiry % 3600000 !== 0 ||
      expiry <= server ||
      expiry - server > 90000000
    )
      throw new Error('The public order day could not be verified. Reload the catalog.');
    if (this.context && raw.business_day < this.context.business_day)
      throw new DOMException('An older public day cannot replace the current day.', 'AbortError');
    const deadline = started + expiry - server;
    this.deadline =
      this.context?.business_day === raw.business_day
        ? Math.min(this.deadline, deadline)
        : deadline;
    this.context = { ...raw };
    if (this.remaining() <= 0)
      throw new Error('The public day expired while loading. Refresh the catalog.');
  }
  validateOrder<T extends PublicOrder>(order: T): T {
    if (
      !order ||
      order.public_contract !== PUBLIC_CONTRACT ||
      !sameIntent(
        {
          contract: order.public_contract,
          business_day: order.business_day,
          expires_at: order.expires_at,
        },
        this.context,
      ) ||
      this.remaining() <= 0 ||
      !['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'].includes(order.status) ||
      !Array.isArray(order.items) ||
      typeof order.order_id !== 'string' ||
      !/^[^@\s]+@example\.(com|org|net)$/.test(order.customer_email) ||
      ['idempotency_key', 'session_hash', 'request_hash', 'PK', 'SK', 'GSI1PK'].some(
        (k) => k in order,
      )
    )
      throw new Error('The shared public order response could not be verified. Refresh history.');
    return order;
  }
}
