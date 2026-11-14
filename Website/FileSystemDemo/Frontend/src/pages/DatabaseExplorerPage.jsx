import { useEffect, useRef, useState } from 'react';
import useAuth from '../features/auth/hooks/useAuth.js';
import useDatabaseFeed from '../features/database/hooks/useDatabaseFeed.js';
import usePreviewVisibility from '../features/database/hooks/usePreviewVisibility.js';
import '../features/database/DatabaseExplorer.css';

const identity = (record) => record.order_id || record.sku || record.id;
const label = (record) =>
  record.order_id
    ? 'Order ' + record.order_id
    : record.sku
      ? record.sku + ' · ' + record.name
      : record.name;
export default function DatabaseExplorerPage() {
  const auth = useAuth(),
    visibility = usePreviewVisibility(),
    [collection, setCollection] = useState('orders'),
    [selected, setSelected] = useState(null),
    [trail, setTrail] = useState([{ id: 'root', name: 'Root' }]),
    [auto, setAuto] = useState(true);
  const scope =
      auth.contentMode || (auth.user.role === 'administrator' ? 'administrator' : 'published'),
    contentKey = auth.accessKey || scope,
    lastAccess = useRef(contentKey);
  const safeTrail = lastAccess.current === contentKey ? trail : [{ id: 'root', name: 'Root' }],
    folder = collection === 'files' ? safeTrail.at(-1).id : 'root';
  useEffect(() => {
    if (lastAccess.current !== contentKey) {
      lastAccess.current = contentKey;
      setTrail([{ id: 'root', name: 'Root' }]);
      if (collection !== 'orders') setSelected(null);
    }
  }, [contentKey, collection]);
  const collectionHeading = useRef(null),
    previousLocation = useRef(collection + ':' + folder);
  useEffect(() => {
    const next = collection + ':' + folder;
    if (previousLocation.current !== next) collectionHeading.current?.focus();
    previousLocation.current = next;
  }, [collection, folder]);
  const feed = useDatabaseFeed({
    collection,
    selected,
    folder,
    scope,
    scopeKey: collection === 'orders' ? 'public-orders-v1' : contentKey,
    active: visibility.active,
    revision: visibility.revision,
    auto,
  });
  const choose = (value) => {
      setCollection(value);
      setSelected(null);
    },
    openFolder = (record) => {
      if (trail.length >= 9 || trail.some((p) => p.id === record.id)) return;
      setTrail((old) => [...old, { id: record.id, name: record.name }]);
      setSelected(null);
    };
  const pending = ['loading', 'refreshing', 'revalidating'].includes(feed.phase),
    scopeLabel =
      scope === 'published'
        ? 'Published records only'
        : scope === 'shared'
          ? 'Shared records, including drafts'
          : 'Administrator-authorized records, including drafts';
  return (
    <main className="database-explorer" aria-labelledby="database-title">
      <header>
        <p className="document-eyebrow">APPLICATION DATA</p>
        <div className="database-heading">
          <h1 id="database-title">Live Database Explorer</h1>
          <span className="database-badge">Read-only</span>
        </div>
        <p>Inspect the records saved by the portfolio’s applications.</p>
        <div className="database-actions">
          <a
            href="/demos/commerce-ordering-platform/index.html"
            target="_top"
            rel="noopener noreferrer"
          >
            Create a sample order <span aria-hidden="true">→</span>
          </a>
          <button onClick={() => choose('products')}>Browse products</button>
        </div>
        <p className="database-muted">
          To change data, use the Ordering demo, File workspace, Documents, or Product catalog.
        </p>
      </header>
      <details className="database-guidance">
        <summary>How updates work</summary>
        <p>
          Auto-refresh checks for updates about every five seconds while this view is visible. New
          orders may take more than one refresh to appear.
        </p>
        <p>
          Public orders remain visible until midnight Eastern. They disappear from this view before
          DynamoDB finishes its background cleanup.
        </p>
        <p>
          Records are retrieved through the applications’ APIs. Results are limited to recent
          orders, product pages, or the folder currently open.
        </p>
      </details>
      <div className="database-controls">
        <button
          onClick={feed.refresh}
          disabled={!visibility.active}
          aria-disabled={pending || !visibility.active}
          aria-busy={pending}
        >
          Refresh
        </button>
        <label>
          <input
            type="checkbox"
            checked={auto}
            onChange={(event) => setAuto(event.target.checked)}
          />{' '}
          Auto-refresh
        </label>
        <span>
          {!visibility.active
            ? 'Paused while hidden'
            : !auto
              ? 'Auto-refresh off'
              : feed.error
                ? 'Auto-refresh on · backing off after an error'
                : 'Auto-refresh on · about every 5 seconds'}
        </span>
        <span>
          Last updated:{' '}
          {feed.updated === null ? 'Not yet verified' : new Date(feed.updated).toLocaleTimeString()}
        </span>
      </div>
      <div className="database-layout">
        <nav className="database-collections" aria-label="Application data">
          <strong>Application data</strong>
          {[
            ['orders', 'Orders'],
            ['products', 'Products'],
            ['files', 'Files and folders'],
          ].map(([key, name]) => (
            <button
              key={key}
              aria-current={collection === key ? 'page' : undefined}
              onClick={() => choose(key)}
            >
              {name}
            </button>
          ))}
        </nav>
        <section className="database-records" aria-label="Record collection">
          <h2 ref={collectionHeading} tabIndex={-1}>
            {collection === 'orders'
              ? 'Orders'
              : collection === 'products'
                ? 'Products'
                : 'Files and folders'}
          </h2>
          {collection === 'orders' ? (
            <>
              <p>Showing up to 20 recent public orders.</p>
            </>
          ) : (
            <>
              <p>{scopeLabel}</p>
              {auth.capabilityStatus === 'loading' && (
                <p>Workspace capabilities are being checked. Only published reads are available.</p>
              )}
              {auth.capabilityStatus === 'error' && (
                <p>
                  Workspace capabilities could not be verified. Only published reads are available.
                </p>
              )}
            </>
          )}
          {collection === 'files' && (
            <nav className="database-breadcrumbs" aria-label="Folder path">
              {safeTrail.map((part, index) => (
                <button
                  key={part.id}
                  onClick={() => {
                    setTrail(safeTrail.slice(0, index + 1));
                    setSelected(null);
                  }}
                >
                  {part.name}
                </button>
              ))}
            </nav>
          )}
          {pending && (
            <p {...(feed.phase === 'refreshing' || feed.error ? {} : { role: 'status' })}>
              {feed.phase === 'refreshing'
                ? 'Refreshing the current view…'
                : feed.phase === 'revalidating'
                  ? 'Revalidating public records…'
                  : 'Loading application records…'}
            </p>
          )}
          {feed.error && (
            <p role="alert">
              {feed.updated !== null
                ? "Couldn't refresh. The last successful results are shown below."
                : 'Records could not be verified.'}{' '}
              <span>{feed.error}</span>
            </p>
          )}
          {feed.note && <p className="database-note">{feed.note}</p>}
          {feed.incomplete && (
            <p role="status">
              Results are incomplete because the API reached its metadata candidate bound. This is
              not every product in the table.
            </p>
          )}
          {feed.phase === 'ready' && feed.rows.length === 0 && (
            <p>
              {collection === 'orders'
                ? 'No public orders are available today. Create a sample order to see its saved record here, or choose Products to explore existing records.'
                : collection === 'products'
                  ? 'No products in this verified read scope.'
                  : 'No visible items in this folder.'}
            </p>
          )}
          {collection === 'files' && feed.phase === 'failed' && folder !== 'root' && (
            <button
              onClick={() => {
                setTrail([{ id: 'root', name: 'Root' }]);
                setSelected(null);
              }}
            >
              Return to root folder
            </button>
          )}
          <ul className="database-list">
            {feed.rows.map((record) => (
              <li
                key={identity(record)}
                data-changed={Boolean(feed.highlights[identity(record)] > Date.now())}
              >
                <button
                  aria-pressed={selected === identity(record)}
                  onClick={() => setSelected(identity(record))}
                >
                  <span>{label(record)}</span>
                  <small>
                    {record.status}
                    {record.total_amount
                      ? ' · ' + record.total_amount + ' ' + record.currency
                      : record.type
                        ? ' · ' + record.type
                        : ''}
                  </small>
                  {feed.highlights[identity(record)] > Date.now() && (
                    <span className="database-change">New or changed</span>
                  )}
                </button>
                {collection === 'files' && record.type === 'folder' && (
                  <button
                    className="database-open-folder"
                    disabled={trail.length >= 9 || trail.some((p) => p.id === record.id)}
                    onClick={() => openFolder(record)}
                  >
                    Open folder <span className="sr-only">{record.name}</span>→
                  </button>
                )}
              </li>
            ))}
          </ul>
          {feed.nextCursor && (
            <button
              disabled={pending || !visibility.active || feed.rows.length >= 60}
              onClick={feed.loadMore}
            >
              Load more products
            </button>
          )}
          {collection === 'products' && feed.rows.length > 0 && (
            <p className="database-muted">
              {feed.rows.length} loaded in this bounded view. Refresh restarts at page one.
            </p>
          )}
        </section>
        <section className="database-inspector" aria-label="Record inspector">
          <h2>{collection === 'orders' ? 'Stored order details' : 'Record details'}</h2>
          {feed.detail ? (
            <>
              <h3>{label(feed.detail)}</h3>
              <dl>
                {Object.entries(feed.detail)
                  .filter(([key]) => !['items', 'tags', 'tag_ids'].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll('_', ' ')}</dt>
                      <dd>{value === null ? 'None' : String(value)}</dd>
                    </div>
                  ))}
              </dl>
              {feed.detail.items && (
                <>
                  <h4>Original product snapshots</h4>
                  <ul>
                    {feed.detail.items.map((item) => (
                      <li key={item.order_item_id}>
                        {item.product_name} ({item.product_sku}) · {item.quantity} ×{' '}
                        {item.unit_price} = {item.line_total} {feed.detail.currency}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <details key={collection + ':' + identity(feed.detail)}>
                <summary>
                  Technical details — JSON
                  <span className="sr-only">
                    {' '}
                    — {collection === 'orders' ? 'Public record JSON' : 'Application record JSON'}
                  </span>
                </summary>
                <pre
                  tabIndex={0}
                  aria-label={
                    collection === 'orders' ? 'Public record JSON' : 'Application record JSON'
                  }
                >
                  {JSON.stringify(feed.detail, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <p>
              {selected
                ? 'Selected record is awaiting a valid direct read.'
                : 'Select a record to view its saved details.'}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
