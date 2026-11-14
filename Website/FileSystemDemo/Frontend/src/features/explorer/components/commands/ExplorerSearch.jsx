import { useExplorerContext } from '../../context/ExplorerContext.jsx'

export default function ExplorerSearch() {
  const { searchQuery, setSearchQuery, setSelectedNodeIds, setSelectionAnchorId, location } = useExplorerContext()
  return <div className="explorer-search"><span aria-hidden="true">⌕</span>
    <input type="search" aria-label="Search files" placeholder="Search My Files" disabled={location === 'recycle'} value={searchQuery}
      onChange={event => { setSearchQuery(event.target.value); setSelectedNodeIds([]); setSelectionAnchorId(null) }} />
    {searchQuery && <button aria-label="Clear search" onClick={() => { setSearchQuery(''); setSelectedNodeIds([]) }}>×</button>}
  </div>
}
