import { contentClient } from '../../../shared/api/httpClient.js';

const productsPath = '/api/catalog/products';

export function getCatalogProducts({ q, tagIds, match, sort, cursor }, signal) {
  const query = new URLSearchParams({ q, tagIds: tagIds.join(','), match, sort, limit: '25' });
  if (cursor) query.set('cursor', cursor);
  return contentClient(productsPath + '?' + query, { signal });
}

export function saveCatalogProduct(draft, status) {
  const editing = Boolean(draft.revision);
  const body = editing
    ? {
        name: draft.name,
        description: draft.description,
        unit_price: draft.unit_price,
        tag_ids: draft.tag_ids,
        expectedRevision: Number(draft.revision),
        ...(status ? { status } : {}),
      }
    : { ...draft };
  return contentClient(productsPath + (editing ? '/' + encodeURIComponent(draft.sku) : ''), {
    method: editing ? 'PATCH' : 'POST',
    body,
  });
}
