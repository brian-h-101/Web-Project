import { contentClient } from '../../../shared/api/httpClient.js';

const identifier = (value) =>
  typeof value === 'string' &&
  (value === 'root' || /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value));
const sku = (value) => typeof value === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(value);
const pick = (record, fields) =>
  Object.fromEntries(fields.filter((k) => k in record).map((k) => [k, record[k]]));
function product(value, scope) {
  if (
    !value ||
    !sku(value.sku) ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    !/^[0-9]+\.[0-9]{2}$/.test(value.unit_price) ||
    value.currency !== 'USD' ||
    !['DRAFT', 'PUBLISHED', 'RETIRED'].includes(value.status) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    (scope === 'published' && value.status !== 'PUBLISHED')
  )
    throw new Error('The product record could not be verified.');
  return pick(value, [
    'product_id',
    'sku',
    'name',
    'description',
    'unit_price',
    'currency',
    'status',
    'revision',
    'tag_ids',
    'tags',
    'created_at',
    'updated_at',
  ]);
}
function node(value, scope) {
  if (
    !value ||
    !identifier(value.id) ||
    !(value.parentId === null || identifier(value.parentId)) ||
    typeof value.name !== 'string' ||
    !['file', 'folder'].includes(value.type) ||
    !['DRAFT', 'PUBLISHED'].includes(value.status) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    (scope === 'published' && value.status !== 'PUBLISHED') ||
    value.deleted
  )
    throw new Error('The file record could not be verified.');
  return pick(value, [
    'id',
    'parentId',
    'name',
    'type',
    'status',
    'revision',
    'size',
    'mimeType',
    'format',
    'tags',
    'tag_ids',
    'linked_sku',
    'createdAt',
    'updatedAt',
  ]);
}
const validScope = (scope) => {
  if (!['published', 'shared', 'administrator'].includes(scope))
    throw new Error('Unverified read scope.');
};
const options = (scope, signal) => {
  validScope(scope);
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error('Only an AbortSignal is supported.');
  return { signal, method: 'GET', publicOnly: scope === 'published', priority: -1 };
};
// Only these named read operations are exported; existing HTTP namespace/write gates stay intact.
export async function products(scope, cursor, signal) {
  if (
    cursor !== null &&
    cursor !== undefined &&
    (typeof cursor !== 'string' || cursor.length > 1024)
  )
    throw new Error('Invalid product cursor.');
  const query = new URLSearchParams({ limit: '20', sort: 'name' });
  if (cursor) query.set('cursor', cursor);
  const value = await contentClient('/api/catalog/products?' + query, options(scope, signal));
  if (
    !value ||
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    typeof value.incomplete !== 'boolean' ||
    !(value.nextCursor === null || typeof value.nextCursor === 'string') ||
    value.nextCursor?.length > 1024 ||
    !Number.isSafeInteger(value.totalWithinCandidates) ||
    value.totalWithinCandidates < value.items.length ||
    !Number.isSafeInteger(value.candidateLimit)
  )
    throw new Error('The bounded product page could not be verified.');
  return {
    ...pick(value, [
      'nextCursor',
      'incomplete',
      'totalWithinCandidates',
      'candidateLimit',
      'indexScope',
    ]),
    items: value.items.map((x) => product(x, scope)),
  };
}
export async function productDetail(scope, id, signal) {
  if (!sku(id)) throw new Error('Invalid product identifier.');
  const value = product(
    await contentClient('/api/catalog/products/' + encodeURIComponent(id), options(scope, signal)),
    scope,
  );
  if (value.sku !== id) throw new Error('Product identifier changed.');
  return value;
}
export async function root(scope, signal) {
  const value = await contentClient('/api/filesystem/root', options(scope, signal));
  if (value?.rootId !== 'root') throw new Error('The root could not be verified.');
  return value.rootId;
}
export async function nodeDetail(scope, id, signal) {
  if (!identifier(id)) throw new Error('Invalid node identifier.');
  const value = node(
    await contentClient('/api/filesystem/nodes/' + encodeURIComponent(id), options(scope, signal)),
    scope,
  );
  if (value.id !== id) throw new Error('Node identifier changed.');
  return value;
}
export async function children(scope, id, signal) {
  if (!identifier(id)) throw new Error('Invalid folder identifier.');
  const value = await contentClient(
    '/api/filesystem/nodes/' + encodeURIComponent(id) + '/children',
    options(scope, signal),
  );
  if (
    value?.folderId !== id ||
    !Array.isArray(value.children) ||
    value.children.length > 40 ||
    value.incomplete !== false ||
    value.children.some((child) => child?.parentId !== id)
  )
    throw new Error('The complete bounded folder could not be verified.');
  return value.children.map((x) => node(x, scope));
}
