import DocumentList from './DocumentList.jsx'
import { groupDocuments } from '../../utils/tagSorting.js'
export default function TagGroupView({ documents }) {
  if (!documents.length) return <DocumentList documents={documents} />
  return <div className="document-groups">{groupDocuments(documents).map(group => <section key={group.tag.id || 'untagged'}><h2>{group.tag.name} <span className="document-muted">({group.documents.length} loaded)</span></h2><DocumentList documents={group.documents} /></section>)}</div>
}
