import DocumentMetadata from './DocumentMetadata.jsx'
import TagChip from '../tags/TagChip.jsx'
export default function DocumentHeader({ document }) {
  return <header className="document-heading"><p className="document-eyebrow">Document</p><h2>{document.name}</h2>
    <DocumentMetadata document={document} /><div className="document-tags" aria-label="Assigned tags">{document.tags.length ? document.tags.map(tag => <TagChip key={tag.id} tag={tag} />) : <span className="document-muted">Untagged</span>}</div></header>
}
