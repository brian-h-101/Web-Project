import { CommerceReader, mergeOrder } from '../api/commerceReader.js';
export { mergeOrder } from '../api/commerceReader.js';
import * as database from '../api/databaseApi.js';

/**
 * Read shapes come from the existing validated adapters; fields vary by collection.
 * @typedef {Awaited<ReturnType<CommerceReader['detail']>> | Awaited<ReturnType<typeof database.productDetail>> | Awaited<ReturnType<typeof database.nodeDetail>>} FeedRecord
 * @typedef {'orders' | 'products' | 'files'} FeedCollection
 * @typedef {'published' | 'shared' | 'administrator'} FeedScope
 * @typedef {object} FeedConfiguration
 * @property {FeedCollection} collection
 * @property {FeedScope} scope
 * @property {string} scopeKey Access-sensitive identity; orders use their public-contract key.
 * @property {string} folder Current folder identifier; other collections use root.
 * @property {string | null} selected Order ID, SKU or node ID, or no selection.
 * @property {boolean} active Whether the view is visible/eligible for reads.
 * @property {boolean} auto Whether settled reads schedule another poll.
 */
/**
 * A snapshot reference stays stable until replaced; callers treat its contents as read-only.
 * @typedef {object} FeedSnapshot
 * @property {FeedRecord[]} rows Bounded current collection records.
 * @property {FeedRecord | null} detail Selected record, possibly outside the list window.
 * @property {'loading' | 'refreshing' | 'revalidating' | 'ready' | 'stale' | 'failed'} phase
 * @property {string | null} error Handled read-failure feedback, not a rejected write.
 * @property {number | null} updated Wall-clock time of the last successful read, or unverified.
 * @property {string | null} nextCursor Product continuation only.
 * @property {boolean} incomplete Whether the bounded product candidate set is incomplete.
 * @property {Record<string, number>} highlights Record IDs mapped to wall-clock expiry times.
 * @property {string} note
 */
/**
 * @typedef {object} FeedDependencies
 * @property {Pick<CommerceReader, 'list' | 'detail' | 'remaining' | 'isCurrent' | 'invalidate'>} [reader]
 * @property {typeof database} [api] Existing GET-only catalog/filesystem operations.
 * @property {() => number} [now] UI timestamp clock, separate from public-day deadlines.
 */
/** @returns {FeedSnapshot} */
const fresh = () => ({
  rows: [],
  detail: null,
  phase: 'loading',
  error: null,
  updated: null,
  nextCursor: null,
  incomplete: false,
  highlights: {},
  note: '',
});
const idOf = (row) => row.order_id || row.sku || row.id;
/**
 * One mounted Database Explorer's read lifecycle, configured by useDatabaseFeed.
 * snapshot() keeps its object identity until emit() or dispose() replaces state;
 * subscribers are notified by emit(), and unsubscribe removes only that listener.
 * version owns in-flight reads; visibilityRevision acknowledges preview/focus
 * revalidation. Neither is a persisted record revision or an access generation.
 * now() supplies UI timestamps/highlights; CommerceReader separately owns the
 * public-day deadline using its monotonic clock.
 */
export class DatabaseFeed {
  /** @param {FeedDependencies} [options] */
  constructor({ reader = new CommerceReader(), api = database, now = () => Date.now() } = {}) {
    this.reader = reader;
    this.api = api;
    this.now = now;
    this.state = fresh();
    this.listeners = new Set();
    this.version = 0;
    this.timer = null;
    this.expiry = null;
    this.resumeTimer = null;
    this.running = null;
    this.active = false;
    this.auto = true;
    this.collection = 'orders';
    this.scope = 'published';
    this.scopeKey = 'published';
    this.folder = 'root';
    this.selected = null;
    this.failures = 0;
    this.visibilityRevision = 0;
  }
  /** @returns {FeedSnapshot} The current snapshot, without allocating a new facade. */
  snapshot = () => this.state;
  /** @param {() => void} listener @returns {() => boolean} Unsubscribe; Set.delete reports removal. */
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  /** @param {Partial<FeedSnapshot>} patch */
  emit(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
  // Invalidate read ownership and timers without changing the current snapshot.
  cancel() {
    this.version++;
    clearTimeout(this.timer);
    clearTimeout(this.expiry);
    clearTimeout(this.highlightTimer);
    clearTimeout(this.resumeTimer);
    this.timer = null;
    this.expiry = null;
    this.resumeTimer = null;
    this.running?.controller.abort();
    this.running = null;
  }
  clearOrders(message = 'Revalidating the public day…') {
    this.reader.invalidate();
    this.emit({ ...fresh(), phase: 'revalidating', note: message });
  }
  // scopeKey identifies the access-sensitive view; selection/activity changes
  // cancel old work too. Polling is scheduled only after a settled read cycle.
  /** @param {FeedConfiguration} settings */
  configure({ collection, scope, scopeKey, folder, selected, active, auto }) {
    const changed =
      collection !== this.collection || folder !== this.folder || scopeKey !== this.scopeKey;
    const selectionChanged = selected !== this.selected,
      activityChanged = active !== this.active,
      autoChanged = auto !== this.auto;
    if (changed || selectionChanged || activityChanged) this.cancel();
    Object.assign(this, { collection, scope, scopeKey, folder, selected, active, auto });
    if (changed) {
      this.reader.invalidate();
      this.failures = 0;
      this.emit(fresh());
    } else if (selectionChanged) this.emit({ detail: null, error: null, note: '' });
    if (!active) {
      if (collection === 'orders' && (activityChanged || changed))
        this.clearOrders('Paused. Public records will be revalidated before they are shown again.');
      this.emit({
        phase: collection === 'orders' ? 'revalidating' : this.state.phase,
        highlights: {},
      });
      return;
    }
    if (changed || selectionChanged || activityChanged) this.refresh();
    else if (autoChanged) {
      clearTimeout(this.timer);
      if (auto) this.schedule();
    }
  }
  revalidate() {
    if (!this.active) return;
    if (this.resumeTimer !== null) return;
    if (this.collection !== 'orders' && this.running) return this.running.promise;
    // Invalidate synchronously on return/focus, even with auto-refresh disabled.
    if (this.collection === 'orders') {
      this.cancel();
      this.clearOrders();
    }
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      this.refresh();
    }, 200);
  }
  schedule() {
    clearTimeout(this.timer);
    if (this.active && this.auto)
      this.timer = setTimeout(
        () => this.refresh(),
        Math.min(60000, 5000 * 2 ** Math.min(4, this.failures)),
      );
  }
  armExpiry() {
    clearTimeout(this.expiry);
    if (this.collection === 'orders' && this.reader.remaining() > 0)
      this.expiry = setTimeout(() => {
        this.cancel();
        this.clearOrders('Public records expired. Revalidate today’s public day.');
        if (this.active && this.auto) this.refresh();
      }, this.reader.remaining() + 1);
  }
  armHighlights() {
    clearTimeout(this.highlightTimer);
    const deadlines = Object.values(this.state.highlights);
    if (deadlines.length)
      this.highlightTimer = setTimeout(
        () => {
          this.emit({
            highlights: Object.fromEntries(
              Object.entries(this.state.highlights).filter(([, until]) => until > this.now()),
            ),
          });
          this.armHighlights();
        },
        Math.max(1, Math.min(...deadlines) - this.now()),
      );
  }
  /**
   * Coalesce pending read work, not returned Promise identity: this async method
   * adopts work.promise. Handled failures are published in the snapshot. Products
   * load bounded pages; a normal refresh restarts page one. There is no write replay.
   * @param {boolean} [more=false] Request the next bounded product page when available.
   * @returns {Promise<void>} Settles after shared work; handled failures update feedback.
   */
  async refresh(more = false) {
    if (!this.active) return;
    clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    if (this.running) return this.running.promise; // Manual/focus/timer subscribers coalesce.
    clearTimeout(this.timer);
    if (more && (!this.state.nextCursor || this.state.rows.length >= 60)) return;
    this.armExpiry(); // A slow selection/manual read must not suspend the existing expiry deadline.
    this.armHighlights();
    const controller = new AbortController(),
      version = this.version,
      work = { controller, promise: null };
    this.running = work;
    const valid = () =>
      this.running === work &&
      this.version === version &&
      !controller.signal.aborted &&
      this.active;
    const prior = this.state,
      collection = this.collection,
      scope = this.scope,
      selected = this.selected,
      folder = this.folder;
    this.emit({
      phase:
        prior.updated !== null
          ? 'refreshing'
          : prior.phase === 'revalidating'
            ? 'revalidating'
            : 'loading',
      error: prior.error,
    });
    work.promise = Promise.resolve()
      .then(async () => {
        let rows,
          detail = null,
          nextCursor = null,
          incomplete = false,
          note = '',
          notFound = false;
        if (collection === 'orders') {
          rows = await this.reader.list(controller.signal);
          if (!valid()) return;
          const old = new Map(prior.rows.map((r) => [r.order_id, r]));
          if (prior.detail) old.set(prior.detail.order_id, prior.detail);
          rows = rows.map((r) => mergeOrder(old.get(r.order_id), r));
          if (selected) {
            try {
              detail = await this.reader.detail(selected, controller.signal);
            } catch (error) {
              if (error.status !== 404) throw error;
              notFound = true;
            }
            if (!valid()) return;
            if (detail) {
              detail = mergeOrder(old.get(selected), detail);
              rows = rows.map((r) => (r.order_id === selected ? detail : r));
              if (!rows.some((r) => r.order_id === selected))
                note =
                  'This selected order is outside the most recent 20 results; its direct record is still valid.';
            } else {
              rows = rows.filter((r) => r.order_id !== selected);
              note = 'The selected public order is no longer available.';
            }
          }
          if (this.reader.remaining() <= 0)
            throw new Error('The public day expired during refresh.');
          rows = rows.filter((r) => this.reader.isCurrent(r));
          if (detail && !this.reader.isCurrent(detail))
            throw new Error('The selected record belongs to an expired day.');
        } else if (collection === 'products') {
          const page = await this.api.products(
            scope,
            more ? prior.nextCursor : null,
            controller.signal,
          );
          if (!valid()) return;
          rows = more
            ? [...prior.rows, ...page.items.filter((r) => !prior.rows.some((p) => p.sku === r.sku))]
            : page.items;
          nextCursor = page.nextCursor;
          incomplete = page.incomplete;
          if (more)
            note =
              'Additional bounded page loaded. A refresh restarts at page one to avoid mixing revisions.';
          else if (prior.rows.length > 20)
            note = 'Refreshed page one. Load more again for the current workspace revision.';
          if (selected) {
            try {
              detail = await this.api.productDetail(scope, selected, controller.signal);
            } catch (error) {
              if (error.status !== 404) throw error;
              notFound = true;
              note = 'The selected product is no longer available.';
            }
          }
        } else {
          await this.api.root(scope, controller.signal);
          if (!valid()) return;
          try {
            rows = await this.api.children(scope, folder, controller.signal);
          } catch (error) {
            if (error.status === 404) {
              this.emit({
                ...fresh(),
                phase: 'failed',
                error: 'This folder is no longer available. Return to the root folder.',
              });
              return;
            }
            throw error;
          }
          if (selected) {
            try {
              detail = await this.api.nodeDetail(scope, selected, controller.signal);
            } catch (error) {
              if (error.status !== 404) throw error;
              notFound = true;
              note = 'The selected file or folder is no longer available.';
            }
            if (detail && detail.parentId !== folder) {
              rows = rows.filter((r) => r.id !== selected);
              note = 'The selected record moved outside this folder; its direct record is shown.';
            }
          }
        }
        if (!valid()) return;
        if (notFound && collection !== 'orders') rows = rows.filter((r) => idOf(r) !== selected);
        const highlights = {},
          old = new Map(prior.rows.map((r) => [idOf(r), r])),
          at = this.now();
        for (const row of rows) {
          const id = idOf(row);
          if (prior.updated !== null && JSON.stringify(old.get(id)) !== JSON.stringify(row))
            highlights[id] = at + 5000;
          else if (prior.highlights[id] > at) highlights[id] = prior.highlights[id];
        }
        this.failures = 0;
        this.emit({
          rows,
          detail,
          phase: 'ready',
          error: null,
          updated: at,
          nextCursor,
          incomplete,
          note,
          highlights,
        });
        this.armExpiry();
        this.armHighlights();
      })
      .catch((error) => {
        if (!valid() || error.name === 'AbortError') return;
        this.failures++;
        if ([401, 403].includes(error.status)) {
          clearTimeout(this.expiry);
          clearTimeout(this.highlightTimer);
          if (collection === 'orders') this.reader.invalidate();
          this.emit({
            ...fresh(),
            phase: 'failed',
            error: 'Read access could not be verified. ' + error.message,
          });
          return;
        }
        if (
          collection === 'orders' &&
          (this.reader.remaining() <= 0 ||
            prior.rows.some((r) => !this.reader.isCurrent(r)) ||
            (prior.detail && !this.reader.isCurrent(prior.detail)))
        ) {
          this.clearOrders('Today’s public records must be revalidated.');
          this.emit({ error: error.message });
          return;
        }
        if (more && ['invalid_cursor', 'revision_conflict'].includes(error.code)) {
          this.emit({
            ...fresh(),
            phase: 'revalidating',
            note: 'The catalog changed. Restarting at page one.',
          });
          queueMicrotask(() => {
            if (valid()) {
              this.running = null;
              this.refresh();
            }
          });
          return;
        }
        this.emit({ phase: prior.updated !== null ? 'stale' : 'failed', error: error.message });
        this.armExpiry();
      })
      .finally(() => {
        if (this.running === work) {
          this.running = null;
          if (this.active) this.schedule();
        }
      });
    return work.promise;
  }
  // The hook's subscription cleanup removes listeners; disposal cancels reads,
  // invalidates public-day data and replaces state without emitting a new view.
  dispose() {
    this.cancel();
    this.active = false;
    this.reader.invalidate();
    this.state = fresh();
  }
}
