import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import FileList from './FileList.jsx'
import FileGrid from './FileGrid.jsx'
import usePermissions from '../../../auth/hooks/usePermissions.js'
import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'

export default function FileView({ directory, selection, onOpen, onContextMenu, onDragStart, onDrop }) {
  const { view, currentFolderId, location, setSearchQuery } = useExplorerContext()
  const { hasPermission } = usePermissions()
  const { openLocation } = useExplorerNavigation()
  const props = { entries: directory.entries, selection, onOpen, onContextMenu, onDragStart, onDrop, showPath: directory.isSearch || location === 'recent' }
  return <section className="file-content" aria-label="Directory contents"
    onClick={event => { if (event.target === event.currentTarget || event.target.classList.contains('empty-state')) selection.clearSelection() }}
    onContextMenu={event => { if (!event.target.closest('[data-node-id]')) onContextMenu(event, null) }}
    onDragOver={event => { if (location === 'files' && event.dataTransfer.types.includes('application/x-file-system-simulator')) event.preventDefault() }}
    onDrop={event => { if (location === 'files') onDrop(event, currentFolderId) }}>
    <div className="content-heading"><h2>{directory.title}</h2>{directory.isRefreshing ? <span>Refreshing…</span> : directory.isSearch && <span>Matching files</span>}</div>
    {directory.unavailable ? <div className="empty-state" role="status"><p>{directory.unavailable}</p><button onClick={() => openLocation('files')}>Back to files</button></div> : directory.isLoading ? <div className="empty-state" role="status">Loading directory…</div> :
      directory.error ? <div className="empty-state" role="alert"><p>{directory.error}</p>{directory.canRetry && <button onClick={directory.retry}>Retry</button>}</div> :
      !directory.entries.length ? <div className="empty-state"><span aria-hidden="true">▱</span><h3>{directory.isSearch ? 'No matching items' : location === 'recycle' ? 'The Recycle Bin is empty' : 'This folder is empty'}</h3><p>{directory.isSearch ? 'No items matched the current filters.' : hasPermission('nodes:create') ? 'Shared workspace items will appear here.' : 'No published items are available in this folder.'}</p>{directory.isSearch && <button onClick={() => setSearchQuery('')}>Clear filters</button>}</div> :
      view.mode === 'details' ? <FileList {...props} /> : <FileGrid {...props} />}
  </section>
}
