import { useEffect, useRef } from 'react'
import { formatDate, formatFileSize, formatFileType } from '../../utils/fileFormatting.js'
import FileIcon from '../content/FileIcon.jsx'

export default function PropertiesDialog({ node, onClose }) {
  const dialog = useRef(null)
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  return <dialog ref={dialog} className="explorer-dialog" aria-labelledby="properties-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="properties-title">Properties</h2>
    {node ? <><div className="properties-name"><FileIcon node={node} large /><strong>{node.name}</strong></div>
      <dl className="properties-list">
        <dt>Type</dt><dd>{formatFileType(node)}</dd><dt>Location</dt><dd>{node.path}</dd>
        <dt>Size</dt><dd>{node.type === 'folder' ? 'Folder total unavailable' : formatFileSize(node.size)}</dd>
        <dt>MIME type</dt><dd>{node.mimeType || 'Not applicable'}</dd>
        <dt>Created</dt><dd>{formatDate(node.createdAt)}</dd><dt>Modified</dt><dd>{formatDate(node.updatedAt)}</dd>
        <dt>Deleted</dt><dd>{formatDate(node.deletedAt)}</dd><dt>Contents</dt><dd>{node.type === 'folder' ? 'Virtual folder' : 'Backend storage; availability checked on preview or download'}</dd>
      </dl></> : <p role="alert">The selected item no longer exists.</p>}
    <div className="dialog-actions"><button autoFocus className="primary" onClick={onClose}>Close</button></div>
  </dialog>
}
