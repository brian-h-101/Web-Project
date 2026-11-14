import { getDescendantIds, isNodeDeleted } from '../model/fileNode.js'

export function validateName(name) {
  if (!name.trim()) return 'Enter a name.'
  if (name !== name.trim() || /[\\/:*?"<>|]/.test(name) || [...name].some(character => character.charCodeAt(0) < 32) || name.endsWith('.') || name === '.' || name === '..') return 'Use a name without leading/trailing spaces, trailing periods, or \\ / : * ? " < > |.'
  return null
}
export function validateNameConflict(nodes, parentId, name, excludedId = null) {
  return nodes.some(node => node.parentId === parentId && node.id !== excludedId && !isNodeDeleted(nodes, node) && node.name.toLowerCase() === name.toLowerCase()) ? 'An item with that name already exists in this folder.' : null
}
export function validateDestination(nodes, ids, parentId) {
  const parent = nodes.find(node => node.id === parentId)
  if (!parent || parent.type !== 'folder' || isNodeDeleted(nodes, parent)) return 'Choose an existing, available destination folder.'
  if (!ids.length) return 'Select an item first.'
  for (const id of ids) {
    const node = nodes.find(item => item.id === id)
    if (!node || isNodeDeleted(nodes, node) || id === 'root') return 'The selected item is unavailable for this operation.'
    if (getDescendantIds(nodes, id).includes(parentId)) return 'A folder cannot be placed inside itself or a descendant.'
  }
  return null
}
