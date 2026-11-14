import { useExplorerContext } from '../context/ExplorerContext.jsx'
import { getNodePath } from '../model/fileNode.js'

export default function useExplorerNavigation() {
  const state = useExplorerContext()
  const { nodes, currentFolderId, location, navigation, connected, rootId } = state
  const currentFolder = nodes.find(node => node.id === currentFolderId)
  const current = { folderId: currentFolderId, location }
  const apply = (entry, ancestors) => {
    state.setCurrentFolderId(entry.folderId)
    state.setLocation(entry.location)
    state.setSearchQuery('')
    state.setSelectedNodeIds([])
    state.setSelectionAnchorId(null)
    state.setContextMenu(null)
    state.setFeedback(null)
    state.setExpandedNodeIds(ids => [...new Set([...ids, ...ancestors.map(node => node.id)])])
  }
  const visit = async (entry, direction) => {
    if (!connected || !entry.folderId) return false
    const request = state.startNavigation()
    const controller = { signal: request.signal }
    try {
      const ancestors = await state.loadAncestry(entry.folderId, controller.signal)
      if (ancestors.at(-1)?.type !== 'folder') throw new Error('Choose an available folder.')
      await Promise.all(ancestors.slice(0, -1).map((parent, index) => {
        const child = ancestors[index + 1]
        const cached = state.directories[parent.id]?.data?.children.find(node => node.id === child.id)
        return state.loadDirectory(parent.id, !!state.directories[parent.id]?.error || !cached || cached.name !== child.name)
      }))
      if (controller.signal.aborted || !state.isLatestNavigation(request)) return false
      state.setNavigation(previous => {
        if (direction === 'back') return { backHistory: previous.backHistory.slice(0, -1), forwardHistory: [...previous.forwardHistory, current] }
        if (direction === 'forward') return { backHistory: [...previous.backHistory, current], forwardHistory: previous.forwardHistory.slice(0, -1) }
        return entry.folderId !== currentFolderId || entry.location !== location ? { backHistory: [...previous.backHistory, current], forwardHistory: [] } : previous
      })
      apply(entry, ancestors)
      return true
    } catch (error) {
      if (!controller.signal.aborted && state.isLatestNavigation(request)) {
        state.connection.failConnection(error)
        state.setFeedback({ type: 'error', message: error.message })
        if (error.status === 404) {
          state.setNavigation(previous => ({ backHistory: previous.backHistory.filter(item => item.folderId !== entry.folderId), forwardHistory: previous.forwardHistory.filter(item => item.folderId !== entry.folderId) }))
          try { await state.loadAncestry(currentFolderId) } catch (currentError) {
            if (currentError.status === 404) await state.recoverFolder(currentFolderId)
            else state.connection.failConnection(currentError)
          }
        }
      }
      return false
    }
  }
  const openFolder = id => visit({ folderId: id, location: 'files' })
  const navigateBack = async () => {
    for (const entry of [...navigation.backHistory].reverse()) {
      if (await visit(entry, 'back')) return
      if (state.connection.error) break
    }
  }
  const navigateForward = async () => {
    for (const entry of [...navigation.forwardHistory].reverse()) {
      if (await visit(entry, 'forward')) return
      if (state.connection.error) break
    }
  }
  const navigateToPath = async path => {
    if (!connected || !path.trim()) { state.setFeedback({ type: 'error', message: 'Enter a virtual folder path, such as /Root/Documents.' }); return false }
    try {
      const segments = path.trim().replaceAll('\\', '/').split('/').filter(Boolean)
      const root = nodes.find(node => node.id === rootId)
      if (segments[0]?.toLowerCase() === root?.name.toLowerCase()) segments.shift()
      let id = rootId
      for (const segment of segments) {
        const directory = await state.loadDirectory(id, true)
        const folder = directory.children.find(node => node.type === 'folder' && node.name.toLowerCase() === segment.toLowerCase())
        if (!folder) throw new Error('Virtual folder path not found: ' + path)
        id = folder.id
      }
      return openFolder(id)
    } catch (error) { state.connection.failConnection(error); state.setFeedback({ type: 'error', message: error.message }); return false }
  }
  return {
    currentFolder, path: getNodePath(nodes, currentFolderId), openFolder, navigateBack, navigateForward,
    navigateUp: () => currentFolder?.parentId && openFolder(currentFolder.parentId), navigateToPath,
    openLocation: target => visit({ folderId: rootId, location: target }),
    expandTreeNode: id => state.setExpandedNodeIds(ids => ids.includes(id) ? ids : [...ids, id]),
    collapseTreeNode: id => state.setExpandedNodeIds(ids => ids.filter(item => item !== id)),
    canGoBack: connected && navigation.backHistory.length > 0,
    canGoForward: connected && navigation.forwardHistory.length > 0,
    canGoUp: connected && location === 'files' && !!currentFolder?.parentId,
  }
}
