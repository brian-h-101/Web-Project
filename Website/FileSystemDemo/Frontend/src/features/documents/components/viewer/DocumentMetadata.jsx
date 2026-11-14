import { documentDate, documentSize } from '../../utils/documentFormatting.js'
export default function DocumentMetadata({ document }) {
  return <dl className="document-metadata">
    <div><dt>Publication</dt><dd>{document.status}</dd></div>
    {document.linked_sku && <div><dt>Linked product SKU</dt><dd>{document.linked_sku}</dd></div>}
    <div><dt>Created</dt><dd>{documentDate(document.createdAt)}</dd></div>
    <div><dt>Last modified</dt><dd>{documentDate(document.updatedAt)}</dd></div>
    <div><dt>File</dt><dd>{document.format} · {documentSize(document.size)} · {document.mimeType || 'Unknown MIME type'}</dd></div>
    <div><dt>Revision</dt><dd>{document.revision}</dd></div>
    <div><dt>Node / folder ID</dt><dd>{document.id} / {document.parentId}</dd></div>
  </dl>
}
