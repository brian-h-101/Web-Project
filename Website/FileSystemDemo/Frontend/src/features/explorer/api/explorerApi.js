import { httpClient as publicClient, contentClient } from '../../../shared/api/httpClient.js'
import { mapNode, mapDirectory } from './nodeMapper.js'
const nodePath = id => '/api/filesystem/nodes/' + encodeURIComponent(id)
// Module-lifetime revision hints, independent of provider directory caches. This
// map survives provider remounts and is not an authorization or visibility cache.
// getNode/getChildren/mutate remember mapped records; create/search/publish retain
// their separate return paths below and do not populate it. The server owns access
// and expectedRevision checks, including rejection of an out-of-date hint.
const observed = new Map()
const remember = node => { observed.set(node.id, node); return node }
export const getHealth = signal => publicClient('/api/filesystem/health', { signal })
export const getRoot = signal => contentClient('/api/filesystem/root', { signal })
export const getNode = async (id, signal) => remember(mapNode(await contentClient(nodePath(id), { signal })))
export const getChildren = async (id, signal) => { const result = mapDirectory(await contentClient(nodePath(id) + '/children', { signal })); result.children.forEach(remember); return result }
export const createFolder = async (parentId, name) => mapNode(await contentClient('/api/filesystem/folders', { method: 'POST', body: { parentId, name } }))
async function mutate(id, method, body = {}, action = '') {
  const current = observed.get(id) || await getNode(id)
  return remember(mapNode(await contentClient(nodePath(id) + action, { method, body: { ...body, expectedRevision: current.revision } })))
}
export const renameNode = (id, name) => mutate(id, 'PATCH', { name })
export const publishNode = (id, status, expectedRevision) => contentClient(nodePath(id), { method: 'PATCH', body: { status, expectedRevision } })
export const moveNode = (id, parentId) => mutate(id, 'POST', { parentId }, '/move')
export const copyNode = (id, parentId, name) => mutate(id, 'POST', { parentId, ...(name ? { name } : {}) }, '/copy')
export const deleteNode = id => mutate(id, 'DELETE')
export const downloadFile = (id, signal) => contentClient('/api/filesystem/documents/' + encodeURIComponent(id) + '/download', { responseType: 'blob', signal })
export const searchNodes = async (query, signal) => {
  const result = await contentClient('/api/filesystem/search?q=' + encodeURIComponent(query), { signal })
  if (result.incomplete) throw new Error('Search reached its candidate limit. Narrow the metadata query.')
  return result.items.map(mapNode)
}
