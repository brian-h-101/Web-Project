/**
 * Produce a new UI record after the existing id/parent/type checks. Revision and
 * size coercion and optional metadata defaults are transport mapping, not a new
 * authorization check or a change to the revision/expectedRevision wire fields.
 */
export function mapNode(record) {
  if (!record || typeof record.id !== 'string' || (record.parentId !== null && typeof record.parentId !== 'string') || !['file', 'folder'].includes(record.type)) {
    throw new Error('The backend returned an invalid file node or identifier.')
  }
  return {
    id: record.id, parentId: record.parentId, name: record.name, type: record.type, status: record.status, revision: Number(record.revision),
    size: record.size == null ? null : Number(record.size), mimeType: record.mimeType ?? null,
    createdAt: record.createdAt ?? null, updatedAt: record.updatedAt ?? null,
    deletedAt: record.deletedAt ?? null, storageKey: record.storageKey ?? null,
  }
}

/** Map one returned directory and its children; no cache or request ownership. */
export function mapDirectory(record) {
  if (typeof record?.folderId !== 'string' || !Array.isArray(record.children)) throw new Error('The backend returned an invalid directory.')
  return { folderId: record.folderId, children: record.children.map(mapNode) }
}
