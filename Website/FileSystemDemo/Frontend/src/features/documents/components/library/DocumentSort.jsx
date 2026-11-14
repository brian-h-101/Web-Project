export default function DocumentSort({ sort, direction, onSort, onDirection }) {
  return <div className="document-sort"><label>Sort by<select value={sort} onChange={event => onSort(event.target.value)}><option value="name">Name</option><option value="updated">Last updated</option><option value="tag_name">Tag name</option><option value="tag_count">Tag count</option></select></label>
    <label>Direction<select value={direction} onChange={event => onDirection(event.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div>
}
