import type { Dispatch, SetStateAction } from 'react';
import type { Order } from '../types/order';
import { dateTime, money } from '../utils/order';
import { StatusBadge } from './OrderDisplay';
interface Props {
  historyLoading: boolean;
  historyError: string | null;
  history: Order[];
  refreshHistory: () => Promise<void>;
  lookup: string;
  setLookup: Dispatch<SetStateAction<string>>;
  selectOrder: (id: string) => Promise<void>;
  loading: boolean;
  cancelling: boolean;
  dayReady: boolean;
}
export function OrderHistory({
  historyLoading,
  historyError,
  history,
  refreshHistory,
  lookup,
  setLookup,
  selectOrder,
  loading,
  cancelling,
  dayReady,
}: Props) {
  return (
    <section className="card history-card" id="history" aria-labelledby="history-title">
      <div className="card-heading">
        <div>
          <span className="eyebrow">SHARED ORDER HISTORY</span>
          <h2 id="history-title">
            Recent orders{' '}
            {!historyLoading && !historyError && (
              <span className="history-count">{history.length}</span>
            )}
          </h2>
        </div>
        <button
          className="text-button"
          disabled={historyLoading}
          onClick={() => void refreshHistory()}
        >
          ↻ Refresh
        </button>
      </div>
      <form
        className="lookup-form"
        onSubmit={(e) => {
          e.preventDefault();
          void selectOrder(lookup);
        }}
      >
        <label htmlFor="lookup">Find an order</label>
        <input
          id="lookup"
          placeholder="Paste the full order ID"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          required
        />
        <button
          className="button button-light"
          disabled={loading || cancelling || !lookup.trim() || !dayReady}
        >
          Look up →
        </button>
      </form>
      {historyError && (
        <div role="alert" className="notice notice-error">
          History could not load. {historyError}
        </div>
      )}
      {historyLoading && (
        <p role="status" className="notice">
          Loading order history…
        </p>
      )}
      {!historyLoading && !historyError && history.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Created</th>
                <th className="align-right">Total</th>
                <th>
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.order_id}>
                  <td>
                    <code title={entry.order_id}>{entry.order_id.slice(0, 8)}</code>
                  </td>
                  <td>{entry.customer_email}</td>
                  <td>
                    <StatusBadge status={entry.status} />
                  </td>
                  <td>{dateTime(entry.created_at)}</td>
                  <td className="align-right">
                    <strong>{money(entry.total_amount, entry.currency)}</strong>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={loading || cancelling}
                      onClick={() => void selectOrder(entry.order_id)}
                      aria-label={`View order ${entry.order_id}`}
                    >
                      View ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !historyLoading && !historyError ? (
        <p className="history-empty">No public orders for the current Eastern day.</p>
      ) : null}
    </section>
  );
}
