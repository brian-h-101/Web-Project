import { useEffect } from 'react'
import { useExplorerContext } from '../context/ExplorerContext.jsx'

export default function useFolderTree(folderId) {
  const { directories, nodes, expandedNodeIds, loadDirectory, connected } = useExplorerContext()
  const expanded = expandedNodeIds.includes(folderId)
  useEffect(() => {
    if (connected && expanded && folderId) loadDirectory(folderId).catch(() => { /* The branch renders its request error below. */ })
  }, [connected, expanded, folderId, loadDirectory])
  const directory = directories[folderId]
  const ids = directory?.data?.children.map(node => node.id) || []
  return {
    expanded, loaded: !!directory?.data, loading: !!directory?.loading,
    error: directory?.error?.message,
    children: nodes.filter(node => ids.includes(node.id) && node.type === 'folder' && !node.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
    retry: () => loadDirectory(folderId, true).catch(() => { /* The branch displays the error. */ }),
  }
}