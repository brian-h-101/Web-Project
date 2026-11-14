import { useState } from 'react'
import TagChip from './TagChip.jsx'
import { sortTags } from '../../utils/tagSorting.js'
export default function TagSelector({ tags, selected, onChange, disabled = false, loading, error }) {
  const [search, setSearch] = useState('')
  const toggle = id => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  return <fieldset className="document-tag-selector" disabled={disabled}>
    <legend>Document tags</legend><div className="document-tags">{sortTags(tags.filter(tag => selected.includes(tag.id))).map(tag => <TagChip key={tag.id} tag={tag} disabled={disabled} onRemove={() => toggle(tag.id)} />)}{!loading && selected.filter(id => !tags.some(tag => tag.id === id)).map(id => <TagChip key={id} tag={{ name: 'Unavailable tag ' + id }} disabled={disabled} onRemove={() => toggle(id)} />)}</div>
    <label>Search existing tags<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
    {loading && <p role="status">Loading tags…</p>}{error && <p role="alert">{error}</p>}
    <div className="document-tag-options">{sortTags(tags).filter(tag => tag.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(tag => <label key={tag.id}><input type="checkbox" checked={selected.includes(tag.id)} onChange={() => toggle(tag.id)} />{tag.name}</label>)}</div>
    {!loading && !tags.length && <p className="document-muted">No tags yet. Content managers can create reusable shared tags.</p>}
  </fieldset>
}
