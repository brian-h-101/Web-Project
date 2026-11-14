import type { IOrderDisplayProps, OrderStatus } from "../types/order";
import { dateTime, money } from "../utils/order";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      <span aria-hidden="true">●</span>{" "}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function OrderDisplay({
  order,
  loading,
  error,
  onCancel,
  cancelling,
  requestKey,
}: IOrderDisplayProps) {
  return (
    <section
      className="card result-card"
      aria-labelledby="result-title"
      aria-live="polite"
      aria-busy={loading}
    >
      <div className="card-heading">
        <div>
          <h2 id="result-title">Order details</h2>
        </div>
        {order && <StatusBadge status={order.status} />}
      </div>
      {error && (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      )}
      {loading && (
        <p role="status" className="notice">
          Working on your request…
        </p>
      )}
      {!order && !loading && !error ? (
        <div className="empty-state">
          <span className="parcel-icon" aria-hidden="true">
            ◇
          </span>
          <h3>No order selected</h3>
          <p>
            Submit an order or select one from history to see its status and
            details here.
          </p>
        </div>
      ) : order ? (
        <>
          <div className="order-meta">
            <span>ORDER ID</span>
            <code>{order.order_id}</code>
            <span>CUSTOMER</span>
            <strong>{order.customer_email}</strong>
            <span>CREATED</span>
            <p>{dateTime(order.created_at)}</p>
            <span>EXPIRES</span>
            <p>{dateTime(order.expires_at)}</p>
          </div>
          <div className="result-items">
            {order.items.map((item) => (
              <div className="result-item" key={item.order_item_id}>
                <div>
                  <strong>{item.product_name}</strong>
                  <small>
                    {item.quantity} × {money(item.unit_price, order.currency)}
                  </small>
                </div>
                <strong>{money(item.line_total, order.currency)}</strong>
              </div>
            ))}
          </div>
          <div className="total-row">
            <span>
              Order total <small>{order.currency}</small>
            </span>
            <strong>{money(order.total_amount, order.currency)}</strong>
          </div>
          {order.failure_reason && (
            <div className="notice notice-error">
              <strong>Processing failed</strong>
              <p>{order.failure_reason}</p>
            </div>
          )}
          {order.status === "CONFIRMED" && (
            <button
              className="button button-danger full-width"
              disabled={cancelling || loading}
              onClick={() => onCancel(order.order_id)}
            >
              {cancelling ? "Cancelling…" : "Cancel this order"}
            </button>
          )}
          {order.status === "CANCELLED" && (
            <p className="muted">
              This order was cancelled. Its original record is preserved.
            </p>
          )}
          {requestKey && <details className="request-details">
            <summary>Request reference</summary>
            <code>{requestKey}</code>
            <p>Last updated {dateTime(order.updated_at)}</p>
          </details>}
        </>
      ) : null}
    </section>
  );
}
