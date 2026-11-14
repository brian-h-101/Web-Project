import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import { formatFileSize } from '../../utils/fileFormatting.js'

export default function ExplorerStatusBar({ entries, loading, error, unavailable }) {
  const { selectedNodeIds, isMutating } = useExplorerContext()
  const selected = entries.filter(node => selectedNodeIds.includes(node.id))
  const availableSize = entries.reduce((sum, node) => sum + (node.size || 0), 0)
  return <footer className="status-bar" aria-live="polite">
    <span>{unavailable ? 'View unavailable in this demo' : loading ? 'Loading items…' : error ? 'Items unavailable' : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`}</span>
    {!unavailable && !loading && !error && <><span>{selected.length} selected</span><span>{formatFileSize(availableSize)} in displayed files</span></>}
    <span className="status-note">{unavailable ? 'Choose an available folder' : isMutating ? 'Saving…' : loading ? 'Loading directory…' : error ? 'Directory request failed' : entries.length ? 'Loaded' : 'No items'}</span>
  </footer>
}
