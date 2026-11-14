import { useEffect, useMemo, useState } from 'react'
import { useExplorerContext } from '../context/ExplorerContext.jsx'
import { searchNodes } from '../api/explorerApi.js'
import { formatFileType } from '../utils/fileFormatting.js'

export default function useDirectory() {
  const state = useExplorerContext()
  const { nodes, currentFolderId, location, searchQuery, view, connected, directories, loadDirectory, loadAncestry, recoverFolder, revision, connection, cacheNodes } = state
  const { failConnection } = connection
  const query = searchQuery.trim()
  const [search, setSearch] = useState({ query: '', nodes: [], loading: false, error: null })
  const unavailable = { recent: !query && 'Recent files are not available in this demo.', recycle: 'Recycle Bin is not available in this demo.' }[location]
  useEffect(() => {
    if (!connected || !currentFolderId || query || unavailable) return
    loadDirectory(currentFolderId, true).catch(error => {
      if (error.status === 404) recoverFolder(currentFolderId)
    })
  }, [connected, currentFolderId, query, unavailable, loadDirectory, recoverFolder])
  useEffect(() => {
    if (!connected || !query || unavailable) return
    const controller = new AbortController()
    const run = async () => {
      await Promise.resolve()
      if (controller.signal.aborted) return
      setSearch({ query, nodes: [], loading: true, error: null })
      try {
        const results = await searchNodes(query, controller.signal)
        cacheNodes(results)
        const currentSearch = new Map(results.map(node => [node.id, node]))
        for (const node of results) {
          if (controller.signal.aborted) return
          await loadAncestry(node.id, controller.signal, currentSearch)
        }
        if (!controller.signal.aborted) setSearch({ query, nodes: results, loading: false, error: null })
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearch({ query, nodes: [], loading: false, error })
          failConnection(error)
        }
      }
    }
    const timer = setTimeout(run, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [connected, query, unavailable, revision, loadAncestry, cacheNodes, failConnection])
  const directory = directories[currentFolderId]
  const entries = useMemo(() => {
    const records = query ? (search.query === query ? search.nodes : []) : (directory?.data?.children || [])
    return [...records].sort((a, b) => {
      let difference = 0
      if (view.sortBy === 'size') difference = (a.size || 0) - (b.size || 0)
      else if (view.sortBy === 'type') difference = formatFileType(a).localeCompare(formatFileType(b))
      else difference = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      if (!difference) difference = a.name.localeCompare(b.name)
      return view.sortDirection === 'asc' ? difference : -difference
    })
  }, [query, search, directory, view.sortBy, view.sortDirection])
  const folder = nodes.find(node => node.id === currentFolderId)
  const error = unavailable ? null : connection.error || (query ? search.error?.message : directory?.error?.message)
  return {
    entries: connected && !unavailable ? entries : [], folder, error, unavailable, canRetry: !unavailable,
    isLoading: !unavailable && (connection.status === 'loading' || (connected && (query ? search.query !== query || search.loading : !directory || (directory.loading && !directory.data)))),
    isRefreshing: !unavailable && !!directory?.loading && !!directory.data,
    title: query ? 'Search results' : ({ home: 'Home', recent: 'Recent', recycle: 'Recycle Bin' }[location] || folder?.name || 'Files'),
    isSearch: !!query, retry: connection.error ? connection.retry : () => {
      if (query) state.synchronize([], [])
      else if (currentFolderId) loadDirectory(currentFolderId, true).catch(error => { if (error.status === 404) recoverFolder(currentFolderId) })
    },
  }
}
