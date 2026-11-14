import { contentClient as httpClient } from '../../../shared/api/httpClient.js'
import { documentModel } from '../model/documentModel.js'
export const DOCUMENT_CHANGED = 'documents:changed'
export function invalidateDocuments() { window.dispatchEvent(new Event(DOCUMENT_CHANGED)) }
const path = id => '/api/filesystem/documents/' + encodeURIComponent(id)
export async function getDocuments(parameters, signal) {
  const query = new URLSearchParams()
  const names = { search: 'q', pageSize: 'limit' }
  Object.entries(parameters).forEach(([key, value]) => { if (key !== 'group' && value !== '' && value != null && value !== false) query.set(names[key] || key, key === 'pageSize' ? '20' : Array.isArray(value) ? value.join(',') : String(value)) })
  const result = await httpClient('/api/filesystem/documents?' + query, { signal })
  return { ...result, total: result.totalWithinCandidates, documents: result.items.map(documentModel) }
}
export const getDocument = async (id, signal) => documentModel(await httpClient(path(id), { signal }))
export const getContent = (id, signal) => httpClient(path(id) + '/content', { signal })
function adapted(body) {
  const { tagIds, expectedRevision, ...rest } = body
  return { ...rest, ...(tagIds ? { tag_ids: tagIds } : {}), ...(expectedRevision != null ? { expectedRevision: Number(expectedRevision) } : {}) }
}
export async function createDocument(body) {
  const document = documentModel(await httpClient('/api/filesystem/documents', { method: 'POST', body: adapted(body) }))
  invalidateDocuments(); return document
}
export async function saveDocument(id, body) {
  const document = documentModel(await httpClient(path(id), { method: 'PATCH', body: adapted(body) }))
  invalidateDocuments(); return document
}
export const assignTags = (id, tagIds, expectedRevision) => saveDocument(id, { tagIds, expectedRevision })
