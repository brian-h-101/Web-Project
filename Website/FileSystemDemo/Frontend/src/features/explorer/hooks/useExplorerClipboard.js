import { useExplorerContext } from '../context/ExplorerContext.jsx'
import useFileOperations from './useFileOperations.js'
import { isNodeDeleted } from '../model/fileNode.js'
import usePermissions from '../../auth/hooks/usePermissions.js'

export default function useExplorerClipboard() {
  const state = useExplorerContext()
  const operations = useFileOperations()
  const { hasPermissions } = usePermissions()
  const capture = operation => {
    if (!hasPermissions('nodes:create', operation === 'cut' ? 'nodes:update' : 'nodes:read')) return
    const ids = state.selectedNodeIds.filter(id => {
      const node = state.nodes.find(item => item.id === id)
      return node && id !== state.rootId && !isNodeDeleted(state.nodes, node)
    })
    if (!ids.length) { state.setFeedback({ type: 'error', message: 'Select available items to ' + operation + '.' }); return }
    state.setClipboard({ nodeIds: ids, operation })
    state.setFeedback({ type: 'info', message: ids.length + ' item(s) ready to ' + (operation === 'cut' ? 'move' : 'copy') + '. Open a destination folder and paste.' })
  }
  const canPaste = hasPermissions('nodes:create', state.clipboard.operation === 'cut' ? 'nodes:update' : 'nodes:read') && state.connected && !state.isMutating && state.clipboard.nodeIds.length > 0 && state.clipboard.nodeIds.every(id => {
    const node = state.nodes.find(item => item.id === id)
    return node && !isNodeDeleted(state.nodes, node)
  })
  const paste = async () => {
    if (!canPaste || state.location !== 'files' || state.searchQuery) {
      state.setFeedback({ type: 'error', message: 'Clipboard unavailable. Copy or cut available items, then open a destination folder.' })
      return
    }
    const { nodeIds, operation } = state.clipboard
    const result = await (operation === 'cut' ? operations.moveNode(nodeIds, state.currentFolderId) : operations.copyNode(nodeIds, state.currentFolderId))
    if (operation === 'cut') state.setClipboard(previous => ({ ...previous, nodeIds: previous.nodeIds.filter(id => !result.completedIds?.includes(id)), operation: previous.nodeIds.every(id => result.completedIds?.includes(id)) ? null : previous.operation }))
  }
  return { cut: () => capture('cut'), copy: () => capture('copy'), paste, canPaste }
}
