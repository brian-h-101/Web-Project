import { Link } from 'react-router'
import TagChip from '../tags/TagChip.jsx'
import { documentDate, documentSize } from '../../utils/documentFormatting.js'
export default function DocumentRow({ document }) {
  return <tr><td><Link to={'/documents/' + document.id}>{document.name}</Link><small>{document.format} · {documentSize(document.size)}</small></td>
    <td><div className="document-tags">{document.tags.length ? document.tags.map(tag => <TagChip key={tag.id} tag={tag} />) : <span className="document-muted">Untagged</span>}</div></td>
    <td>{document.status}</td><td>{documentDate(document.updatedAt)}</td></tr>
}
