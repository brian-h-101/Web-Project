import { useCallback, useEffect, useState } from 'react';
import useAuth from '../features/auth/hooks/useAuth.js';
import { saveCatalogProduct } from '../features/catalog/api/catalogApi.js';
import useCatalogProducts from '../features/catalog/hooks/useCatalogProducts.js';
import useTagCatalog from '../features/documents/hooks/useTagCatalog.js';
import TagFilter from '../features/documents/components/library/TagFilter.jsx';
import CreateTagDialog from '../features/documents/components/tags/CreateTagDialog.jsx';
const blank = { sku: '', name: '', description: '', unit_price: '', tag_ids: [] };
export default function CatalogPage() {
  const auth = useAuth(),
    canManage = auth.permissions.includes('catalog:write'),
    tags = useTagCatalog();
  const [q, setQ] = useState(''),
    [selected, setSelected] = useState([]),
    [match, setMatch] = useState('any'),
    [sort, setSort] = useState('name');
  const [mutationError, setMutationError] = useState(null),
    [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [tagDialog, setTagDialog] = useState(null);
  const clearMutationError = useCallback(() => setMutationError(null), []);
  const products = useCatalogProducts({ q, tagIds: selected, match, sort }, clearMutationError);
  const { data, loading, refresh, loadMore } = products;
  const error = mutationError || products.error?.message;
  function clearProductError() {
    clearMutationError();
    products.clearError();
  }
  useEffect(() => {
    if (!canManage) {
      setDraft(null);
      setTagDialog(null);
    }
  }, [canManage]);
  async function save(event, status) {
    event?.preventDefault();
    if (!canManage || !draft) {
      setMutationError('Content management is unavailable. Refresh workspace capabilities.');
      return;
    }
    setBusy(true);
    clearProductError();
    try {
      await saveCatalogProduct(draft, status);
      setDraft(null);
      refresh();
    } catch (e) {
      setMutationError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="catalog-main">
      <p className="document-eyebrow">
        Non-commercial sample catalog · Shared with Product Ordering Platform
      </p>
      <div className="catalog-heading">
        <div>
          <h2>Product Catalog</h2>
          <p>Browse sample products, tags, and prices.</p>
        </div>
        {canManage && (
          <button className="document-primary" onClick={() => setDraft({ ...blank })}>
            Create product
          </button>
        )}
      </div>
      <div className="catalog-controls">
        <label>
          Search product metadata
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              clearProductError();
            }}
            placeholder="Name, description or SKU"
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option>
            <option value="tag_name">Tag name</option>
            <option value="tag_count">Tag count</option>
            <option value="updated">Updated</option>
          </select>
        </label>
      </div>
      <TagFilter
        tags={tags.tags}
        selected={selected}
        match={match}
        onSelected={setSelected}
        onMatch={setMatch}
      />
      {canManage && (
        <div className="catalog-tags">
          <button onClick={() => setTagDialog({})}>Create tag</button>
          {tags.tags.map((tag) => (
            <button key={tag.id} onClick={() => setTagDialog(tag)}>
              Manage {tag.name}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="document-error">
          {error} <button onClick={refresh}>Retry products</button>
        </p>
      )}
      {tags.error && (
        <p role="alert" className="document-error">
          {tags.error} <button onClick={tags.refresh}>Retry tags</button>
        </p>
      )}
      {canManage && draft && (
        <form className="catalog-editor" onSubmit={save}>
          <h2>{draft.revision ? 'Edit ' + draft.sku : 'New draft product'}</h2>
          <label>
            SKU (immutable)
            <input
              required
              maxLength={40}
              disabled={Boolean(draft.revision) || busy}
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Name
            <input
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              required
              maxLength={500}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label>
            USD unit price
            <input
              required
              pattern="[0-9]+[.][0-9]{2}"
              placeholder="12.50"
              value={draft.unit_price}
              onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Assign up to four tags</legend>
            {tags.tags.map((tag) => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  checked={draft.tag_ids.includes(tag.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tag_ids: e.target.checked
                        ? [...draft.tag_ids, tag.id]
                        : draft.tag_ids.filter((id) => id !== tag.id),
                    })
                  }
                />
                {tag.name}
              </label>
            ))}
          </fieldset>
          <div className="catalog-actions">
            <button disabled={busy}>Save {draft.revision ? 'changes' : 'draft'}</button>
            {draft.status === 'DRAFT' && (
              <button type="button" disabled={busy} onClick={() => save(null, 'PUBLISHED')}>
                Save and publish
              </button>
            )}
            {draft.status === 'PUBLISHED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm('Retire this product? Retirement is permanent.'))
                    save(null, 'RETIRED');
                }}
              >
                Retire product
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading && <p role="status">Loading products…</p>}
      {!loading && !error && data?.incomplete && (
        <p role="status">
          Search reached its {data.candidateLimit}-candidate bound. Narrow your query; results are
          incomplete.
        </p>
      )}
      {!loading && !error && (
        <div className="catalog-grid">
          {data?.items.map((product) => (
            <article className="catalog-card" key={product.sku}>
              <p className="document-eyebrow">
                {product.sku} · {product.status}
              </p>
              <h3>{product.name}</h3>
              {product.description.trim() !==
                'Original non-commercial Commerce demonstration product.' && (
                <p>{product.description}</p>
              )}
              <strong className="catalog-price">${product.unit_price} USD</strong>
              <div className="document-tags">
                {product.tags.map((tag) => (
                  <button key={tag.id} onClick={() => setSelected([tag.id])}>
                    {tag.name}
                  </button>
                ))}
              </div>
              {canManage && (
                <button onClick={() => setDraft({ ...product, tag_ids: [...product.tag_ids] })}>
                  Edit product
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {!loading && !error && data?.items.length === 0 && (
        <div className="document-empty">
          <p>
            {q || selected.length
              ? 'No products match these filters.'
              : canManage
                ? 'No products are currently available in this shared workspace.'
                : 'No published products are currently available.'}
          </p>
          {(q || selected.length > 0) && (
            <button
              onClick={() => {
                setQ('');
                setSelected([]);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {!loading && !error && data?.nextCursor && <button onClick={loadMore}>Load more</button>}
      {canManage && tagDialog && (
        <CreateTagDialog
          tag={tagDialog.id ? tagDialog : null}
          canDelete
          onClose={() => {
            setTagDialog(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}
