import { contentClient as httpClient } from '../../../shared/api/httpClient.js'
import { invalidateDocuments } from './documentApi.js'
export const getTags = async signal => (await httpClient('/api/catalog/tags', { signal })).tags
async function mutate(path, method, body) {
  const result = await httpClient(path, { method, body })
  invalidateDocuments(); return result
}
export const createTag = name => mutate('/api/catalog/tags', 'POST', { name })
async function revision(id) { const tag = (await getTags()).find(item => item.id === id); if (!tag) throw new Error('Tag no longer exists. Refresh.'); return Number(tag.revision) }
export const renameTag = async (id, name, expectedRevision) => mutate('/api/catalog/tags/' + encodeURIComponent(id), 'PATCH', { name, expectedRevision: expectedRevision == null ? await revision(id) : Number(expectedRevision) })
export const removeTag = async (id, expectedRevision) => mutate('/api/catalog/tags/' + encodeURIComponent(id), 'DELETE', { expectedRevision: expectedRevision == null ? await revision(id) : Number(expectedRevision) })
