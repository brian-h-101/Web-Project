export default function DocumentSearch({ value, onChange }) {
  return <label className="document-search">Search documents<input type="search" placeholder="Search by filename…" value={value} onChange={event => onChange(event.target.value)} maxLength={255} /></label>
}
