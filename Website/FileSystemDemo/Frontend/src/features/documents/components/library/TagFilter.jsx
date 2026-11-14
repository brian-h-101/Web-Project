export default function TagFilter({ tags, selected, match, onSelected, onMatch }) {
  return <fieldset className="document-filter"><legend>Filter by tags</legend><div className="document-tag-options">{tags.map(tag => <label key={tag.id}><input type="checkbox" checked={selected.includes(tag.id)} onChange={() => onSelected(selected.includes(tag.id) ? selected.filter(id => id !== tag.id) : [...selected, tag.id])} />{tag.name}</label>)}</div>
    <label>Match<select value={match} onChange={event => onMatch(event.target.value)}><option value="any">ANY selected tag</option><option value="all">ALL selected tags</option></select></label>{selected.length > 0 && <button onClick={() => onSelected([])}>Clear tag filters</button>}</fieldset>
}
