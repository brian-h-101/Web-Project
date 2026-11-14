import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import useDocument from '../features/documents/hooks/useDocument.js'
import useDocumentEditor from '../features/documents/hooks/useDocumentEditor.js'
import useDocumentPermissions from '../features/documents/hooks/useDocumentPermissions.js'
import useTagCatalog from '../features/documents/hooks/useTagCatalog.js'
import useSaveDocument from '../features/documents/hooks/useSaveDocument.js'
import DocumentHeader from '../features/documents/components/viewer/DocumentHeader.jsx'
import DocumentViewer from '../features/documents/components/viewer/DocumentViewer.jsx'
import DocumentEditor from '../features/documents/components/editor/DocumentEditor.jsx'
import DocumentToolbar from '../features/documents/components/editor/DocumentToolbar.jsx'
import SaveConflictDialog from '../features/documents/components/editor/SaveConflictDialog.jsx'
import CreateTagDialog from '../features/documents/components/tags/CreateTagDialog.jsx'
import { isEditableFormat } from '../features/documents/model/documentModel.js'
import { validateDocument } from '../features/documents/utils/documentValidation.js'
import { deleteNode, downloadFile, publishNode } from '../features/explorer/api/explorerApi.js'
import { invalidateDocuments } from '../features/documents/api/documentApi.js'

export default function DocumentPage() {
  const { id } = useParams(), navigate = useNavigate()
  const data = useDocument(id), editor = useDocumentEditor(), catalog = useTagCatalog(), saver = useSaveDocument()
  const permissions = useDocumentPermissions(data.document)
  const [error, setError] = useState(null), [notice, setNotice] = useState(null), [tagDialog, setTagDialog] = useState(false), [downloading, setDownloading] = useState(false)
  const canEdit = permissions.canEdit && isEditableFormat(data.document?.format) && !data.contentError
  const save = async () => {
    if (!editor.draft || (!permissions.canEdit && !permissions.canTag)) { setError('Content management is unavailable. Refresh workspace capabilities.'); return }
    setError(null)
    if (canEdit) { const invalid = validateDocument(editor.draft, data.document.format); if (invalid) { setError(invalid); return } }
    const body = { expectedRevision: editor.draft.expectedRevision }
    if (canEdit) { body.name = editor.draft.name; body.content = editor.draft.content }
    if (permissions.canTag) { body.tagIds = editor.draft.tagIds; body.linked_sku = editor.draft.linkedSku || null }
    const saved = await saver.save(id, body)
    if (saved) { editor.close(); setNotice('Saved revision ' + saved.revision + '.'); data.refresh() }
  }
  const download = async () => {
    setError(null); setDownloading(true)
    try {
      const blob = await downloadFile(id), url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = data.document.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { setError(failure.message) } finally { setDownloading(false) }
  }
  const remove = async () => {
    if (!permissions.canDelete) return
    if (!window.confirm('Delete this document from the virtual filesystem?')) return
    try { await deleteNode(id); invalidateDocuments(); navigate('/documents') } catch (failure) { setError(failure.message) }
  }
  const leave = event => { if (editor.dirty && !window.confirm('Discard your unsaved document changes?')) event.preventDefault() }
  return <div className="documents-app"><header className="documents-topbar"><Link to="/documents" onClick={leave}>← Back to Documents</Link></header>
    <main className="document-detail">
      {data.error && <div role="alert" className="document-error">{data.error}<button onClick={data.refresh}>Retry</button></div>}
      {error && <p role="alert" className="document-error">{error}</p>}{notice && <p role="status" className="document-success">{notice}</p>}
      {data.loading && <p role="status">Loading document…</p>}
      {data.document && <><DocumentHeader document={data.document} />
        {permissions.canEdit && !editor.draft && <button onClick={async () => { try { await publishNode(id, data.document.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', Number(data.document.revision)); data.refresh() } catch (e) { setError(e.message) } }}>{data.document.status === 'PUBLISHED' ? 'Unpublish document' : 'Publish document'}</button>}
        {editor.draft && (permissions.canEdit || permissions.canTag) ? <DocumentEditor draft={editor.draft} setDraft={editor.setDraft} format={data.document.format} canEdit={canEdit} canTag={permissions.canTag} catalog={catalog} pending={saver.pending} dirty={editor.dirty} error={saver.error} onSave={save} onCancel={() => { editor.cancel(); saver.reset() }} onDownload={download} onCreateTag={permissions.canCreateTag ? () => setTagDialog(true) : null} /> : <>
          <DocumentToolbar canEdit={canEdit} canTag={permissions.canTag} canDelete={permissions.canDelete} onDelete={remove} pending={downloading || data.loading} onEdit={() => { editor.begin(data.document, data.content); saver.reset(); setNotice(null) }} onDownload={download} />
          {!data.loading && <DocumentViewer document={data.document} content={data.content} contentError={data.contentError} />}</>}
      </>}
      {saver.conflict && <SaveConflictDialog onCancel={() => saver.setConflict(false)} onReload={() => { saver.reset(); editor.close(); data.refresh() }} />}
      {tagDialog && permissions.canCreateTag && <CreateTagDialog onClose={() => setTagDialog(false)} />}
    </main></div>
}
