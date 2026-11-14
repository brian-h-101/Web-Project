// One retry layer for idempotent reads only. No mutation passes through here.
export const READ_DEADLINE_MS = 10_000;
export const READ_ATTEMPTS = 4;
const retryStatuses = new Set([408, 429, 500, 502, 503, 504]);
export interface ReadClock {
  now(): number;
  random(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}
const clock: ReadClock = {
  now: Date.now,
  random: Math.random,
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const stop = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', stop);
        resolve();
      }, ms);
      signal?.addEventListener('abort', stop, { once: true });
    }),
};
function retryAfter(response: Response, now: number): number {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
export async function boundedRead(
  fetcher: (signal: AbortSignal) => Promise<Response>,
  signal?: AbortSignal,
  time = clock,
): Promise<Response> {
  const deadline = time.now() + READ_DEADLINE_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    signal?.throwIfAborted();
    const remaining = deadline - time.now();
    if (remaining <= 0) break;
    let response: Response | undefined;
    try {
      const timeout = AbortSignal.timeout(Math.max(1, Math.min(4000, Math.floor(remaining))));
      response = await fetcher(signal ? AbortSignal.any([signal, timeout]) : timeout);
      signal?.throwIfAborted();
      if (time.now() >= deadline) throw new DOMException('Read deadline exceeded', 'TimeoutError');
      if (!retryStatuses.has(response.status) || attempt === READ_ATTEMPTS - 1) return response;
    } catch (error) {
      signal?.throwIfAborted();
      if (
        !(error instanceof TypeError) &&
        !(error instanceof DOMException && error.name === 'TimeoutError')
      )
        throw error;
      lastError = error;
      response = undefined;
      if (attempt === READ_ATTEMPTS - 1) throw error;
    }
    const wait = Math.max(
      Math.min(2000, 300 * 2 ** attempt + time.random() * 200),
      response ? retryAfter(response, time.now()) : 0,
    );
    if (wait >= deadline - time.now()) {
      if (response) return response;
      break;
    }
    // Release a failed response before waiting; never retry earlier than Retry-After.
    await response?.body?.cancel();
    await time.sleep(wait, signal);
  }
  throw lastError || new DOMException('Read deadline exceeded', 'TimeoutError');
}
