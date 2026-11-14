import { useExplorerContext } from '../context/ExplorerContext.jsx'

export default function useFileSelection(entries) {
  const state = useExplorerContext()
  const selectNode = (id, event = {}) => {
    const ids = entries.map(node => node.id)
    if (event.shiftKey && ids.includes(state.selectionAnchorId)) {
      const start = ids.indexOf(state.selectionAnchorId)
      const end = ids.indexOf(id)
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1)
      state.setSelectedNodeIds(event.ctrlKey || event.metaKey ? [...new Set([...state.selectedNodeIds, ...range])] : range)
    } else if (event.ctrlKey || event.metaKey) {
      state.setSelectedNodeIds(selected => selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id])
      state.setSelectionAnchorId(id)
    } else {
      state.setSelectedNodeIds([id])
      state.setSelectionAnchorId(id)
    }
    state.setContextMenu(null)
  }
  const clearSelection = () => { state.setSelectedNodeIds([]); state.setSelectionAnchorId(null) }
  return { selectedNodeIds: state.selectedNodeIds, selectNode, clearSelection }
}
