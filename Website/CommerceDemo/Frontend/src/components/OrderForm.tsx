import type { Dispatch, SetStateAction, FormEvent } from 'react';
import type { CreateOrderRequest, Product, Submission, ValidationIssue } from '../types/order';
import { estimate, money } from '../utils/order';
interface Props {
  catalogError: string | null;
  loadCurrentDay: () => Promise<void>;
  catalogLoading: boolean;
  catalogReview: boolean;
  draft: CreateOrderRequest;
  products: Product[];
  acceptCatalog: () => void;
  locked: boolean;
  loading: boolean;
  dayReady: boolean;
  setDraft: Dispatch<SetStateAction<CreateOrderRequest>>;
  issues: ValidationIssue[];
  selectedSku: string;
  chooseSku: (sku: string) => void;
  quantity: number;
  setQuantity: Dispatch<SetStateAction<number>>;
  addItem: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  lastSubmission: Submission | null;
  cancelling: boolean;
  savedValid: boolean;
  send: (value: Submission, replay: boolean) => Promise<void>;
  keyValue: string;
}
export function OrderForm({
  catalogError,
  loadCurrentDay,
  catalogLoading,
  catalogReview,
  draft,
  products,
  acceptCatalog,
  locked,
  loading,
  dayReady,
  setDraft,
  issues,
  selectedSku,
  chooseSku,
  quantity,
  setQuantity,
  addItem,
  submit,
  lastSubmission,
  cancelling,
  savedValid,
  send,
  keyValue,
}: Props) {
  return (
    <section className="card form-card" aria-labelledby="form-title" id="order-form">
      <div className="card-heading">
        <div>
          <h2 id="form-title">Create an order</h2>
        </div>
        <span className="step-tag">01 — DETAILS</span>
      </div>
      {catalogError && (
        <div role="alert" className="notice notice-error">
          {catalogError}{' '}
          <button type="button" className="text-button" onClick={() => void loadCurrentDay()}>
            Reload catalog
          </button>
        </div>
      )}
      {catalogLoading && (
        <p role="status" className="notice">
          Loading product catalog…
        </p>
      )}
      {catalogReview && (
        <div role="alert" className="notice notice-error">
          The product catalog changed. Review prices and remove unavailable items before submitting.{' '}
          <button
            type="button"
            className="text-button"
            disabled={
              catalogLoading ||
              !!catalogError ||
              draft.items.some(
                (item) => !products.some((product) => product.sku === item.product_sku),
              )
            }
            onClick={() => {
              acceptCatalog();
            }}
          >
            Use reviewed catalog
          </button>
        </div>
      )}
      {!catalogLoading && !catalogError && products.length === 0 && (
        <p role="status" className="notice">
          No products are currently available.{' '}
          <button type="button" className="text-button" onClick={() => void loadCurrentDay()}>
            Reload catalog
          </button>
        </p>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={locked || loading || catalogLoading || !!catalogError || !dayReady}>
          <label htmlFor="customer-email">
            Customer email <span className="required">*</span>
          </label>
          <input
            id="customer-email"
            type="email"
            placeholder="demo@example.com"
            value={draft.customer_email}
            maxLength={255}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, customer_email: e.target.value })}
            aria-invalid={issues.some((i) => i.field === 'customer_email')}
          />
          <p className="field-hint">
            Sample information only: use an example.com, example.org or example.net address.
          </p>
          <div className="section-rule">
            <span>Order items</span>
          </div>
          <div className="add-item-row">
            <div className="product-select">
              <label htmlFor="product">Product</label>
              <select
                id="product"
                value={selectedSku}
                onChange={(e) => {
                  chooseSku(e.target.value);
                }}
              >
                {catalogLoading ? (
                  <option>Loading catalog…</option>
                ) : (
                  [
                    <option key="choose" value="">
                      Choose a product
                    </option>,
                    ...products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.name} · {money(p.unit_price)}
                      </option>
                    )),
                  ]
                )}
              </select>
            </div>
            <div className="quantity-input">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="1"
                max="99"
                step="1"
                value={Number.isNaN(quantity) ? '' : quantity}
                onChange={(e) => setQuantity(e.target.valueAsNumber)}
              />
            </div>
            <button type="button" className="button button-light add-button" onClick={addItem}>
              ＋ Add
            </button>
          </div>
          <div className="cart-items">
            {draft.items.length ? (
              draft.items.map((item) => {
                const product = products.find((p) => p.sku === item.product_sku)!;
                return (
                  <div className="cart-item" key={item.product_sku}>
                    <span className="product-symbol" aria-hidden="true">
                      {product?.name.charAt(0)}
                    </span>
                    <div className="cart-item-name">
                      <strong>{product?.name ?? item.product_sku}</strong>
                      <small>
                        {item.quantity} × {money(product?.unit_price ?? '0')}
                      </small>
                    </div>
                    <strong>{money(estimate({ ...draft, items: [item] }, products))}</strong>
                    <button
                      type="button"
                      className="remove-button"
                      aria-label={`Remove ${product?.name ?? item.product_sku}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter((i) => i.product_sku !== item.product_sku),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="cart-empty">
                <span aria-hidden="true">＋</span>
                <p>Choose a product above and add it to the order.</p>
              </div>
            )}
          </div>
          <div className="total-row">
            <span>
              Estimated total <small>USD</small>
            </span>
            <strong>{money(estimate(draft, products))}</strong>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.simulate_failure}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  simulate_failure: e.target.checked,
                })
              }
            />
            <span>
              Simulate a processing failure
              <small>Test a processing failure using a sample order.</small>
            </span>
          </label>
        </fieldset>
        {!!issues.length && (
          <div role="alert" className="notice notice-error">
            <strong>Check your order</strong>
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="submit"
          className="button button-primary full-width submit-button"
          disabled={
            loading || locked || catalogLoading || !!catalogError || catalogReview || !dayReady
          }
        >
          {loading ? 'Processing request…' : locked ? 'Request submitted' : 'Submit order →'}
        </button>
        <p className="submit-note">Prices and totals are confirmed by the server.</p>
      </form>
      <div className="retry-panel">
        <div>
          <strong>{locked ? 'Saved request' : 'Request retries'}</strong>
          <p>
            {locked
              ? 'Retry sends the saved order exactly as it was. Start a new order to change the details.'
              : 'This order has its own request key, so a retry will not create another order.'}
          </p>
        </div>
        {lastSubmission && (
          <button
            className="button button-light"
            disabled={loading || cancelling || !savedValid}
            onClick={() => void send(lastSubmission, true)}
          >
            Retry original request
          </button>
        )}
        <details>
          <summary>Idempotency key</summary>
          <code>{keyValue}</code>
        </details>
      </div>
      {lastSubmission && dayReady && !savedValid && (
        <p role="status" className="notice">
          This saved request belongs to an expired public day. Start a new order; its key and day
          will not be renewed.
        </p>
      )}
    </section>
  );
}
