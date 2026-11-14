import { useExplorerContext } from '../../context/ExplorerContext.jsx'

export default function SortControls() {
  const { view, setView } = useExplorerContext()
  return <details className="sort-controls"><summary>⇅ Sort</summary><div className="sort-popover">
    <label>Sort by<select aria-label="Sort by" value={view.sortBy} onChange={event => setView({ ...view, sortBy: event.target.value })}>
      <option value="name">Name</option><option value="type">Type</option><option value="size">Size</option>
    </select></label>
    <label>Direction<select aria-label="Sort direction" value={view.sortDirection} onChange={event => setView({ ...view, sortDirection: event.target.value })}>
      <option value="asc">Ascending</option><option value="desc">Descending</option>
    </select></label>
  </div></details>
}
