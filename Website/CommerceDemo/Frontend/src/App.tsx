import { useEffect, useMemo, useState } from 'react';
import { OrderContainer, type CatalogState } from './components/OrderContainer';
import { ApiOrderService } from './strategies/ApiOrderService';
import { BasicOrderValidator } from './strategies/BasicOrderValidator';
import '../../../Shared/demo-theme.css';
import '../../../Frontend/shared/demo-notices.css';
export default function App() {
  const embedded = window.self !== window.top;
  const service = useMemo(() => new ApiOrderService(), []);
  const validator = useMemo(() => new BasicOrderValidator(), []);
  const [catalogState, setCatalogState] = useState<CatalogState>('loading');
  useEffect(() => {
    if (!embedded) return;
    const report = () =>
      window.parent.postMessage(
        { source: 'commerce-demo', type: 'catalog-state', state: catalogState },
        window.location.origin,
      );
    const receive = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === window.parent &&
        event.data?.source === 'portfolio-demo' &&
        event.data?.type === 'commerce-status-request'
      )
        report();
    };
    window.addEventListener('message', receive);
    report();
    return () => window.removeEventListener('message', receive);
  }, [catalogState, embedded]);
  return (
    <div data-presentation={embedded ? 'embedded' : 'standalone'}>
      {!embedded && (
        <>
          <header className="demo-header">
            <div className="demo-identity">
              Brian Ho <span>Product Ordering Platform</span>
            </div>
            <nav className="demo-links" aria-label="Portfolio navigation">
              <a href="/projects/commerce-ordering-platform">Back to Project</a>
              <a href="/#projects">Projects</a>
            </nav>
          </header>
          <section className="demo-intro">
            <h1>Product Ordering Platform</h1>
            <p>
              Create sample orders and inspect how validation, persistence, and explicit retries
              work.
            </p>
          </section>
        </>
      )}
      <section className="demo-notice" aria-label="Public demonstration notice">
        <p>
          <strong>
            Public demo: orders and sample email addresses are visible to everyone. Anyone can
            cancel an active confirmed order. Orders expire at midnight Eastern. No payments are
            collected.
          </strong>
        </p>
        <span className="notice-status" role="status">
          {catalogState === 'loading'
            ? 'Checking product catalog…'
            : catalogState === 'ready'
              ? 'Product catalog loaded.'
              : 'Product catalog unavailable.'}
        </span>
        <details>
          <summary>How this demo works</summary>
          <p>
            Use sample addresses at example.com, example.org or example.net. There are no purchases
            or customer accounts.
          </p>
          <p>
            Orders expire at the next midnight America/New_York, including daylight-saving changes.
            Cancelled orders remain visible until expiry; legacy private records stay private.
          </p>
          <p>
            {import.meta.env.VITE_CATALOG_RESET_ACTIVE === 'true'
              ? 'The entire sample product catalog resets to the five defaults nightly at 12 AM Eastern.'
              : 'Daily catalog reset is not active. Once enabled, the entire sample product catalog will reset to the five defaults nightly at 12 AM Eastern.'}{' '}
            Catalog resets do not rewrite existing order snapshots.
          </p>
        </details>
      </section>
      <OrderContainer
        service={service}
        validator={validator}
        onCatalogStateChange={setCatalogState}
      />
    </div>
  );
}
