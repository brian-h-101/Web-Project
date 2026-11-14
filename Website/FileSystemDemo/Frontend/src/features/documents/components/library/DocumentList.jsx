import DocumentRow from './DocumentRow.jsx'
export default function DocumentList({ documents, filtered = false, canCreate = false, onClear }) {
  if (!documents.length) return <div className="document-empty"><h3>{filtered ? 'No documents match your search.' : 'No documents found'}</h3>{!filtered && <p>{canCreate ? 'Create a document in a virtual folder to begin.' : 'No published documents are currently available.'}</p>}{filtered && onClear && <button onClick={onClear}>Clear filters</button>}</div>
  return <div className="document-table-scroll" tabIndex={0} role="region" aria-label="Document results"><table className="document-list"><thead><tr><th>Document</th><th>Tags</th><th>Publication</th><th>Last updated</th></tr></thead><tbody>{documents.map(document => <DocumentRow key={document.id} document={document} />)}</tbody></table></div>
}
