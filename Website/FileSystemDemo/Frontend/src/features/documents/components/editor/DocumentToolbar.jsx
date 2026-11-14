export default function DocumentToolbar({ editing, pending, dirty, canSave = true, canEdit, canTag, onEdit, onSave, onCancel, onDownload, canDelete, onDelete }) {
  return <div className="document-actions document-toolbar" role="toolbar" aria-label="Document commands">
    {editing ? <><button type="submit" className="document-primary" disabled={pending || !dirty || !canSave} onClick={onSave}>{pending ? 'Saving…' : 'Save'}</button><button type="button" disabled={pending} onClick={onCancel}>Cancel</button><span className="document-muted" role="status">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span></> : <>{(canEdit || canTag) && <button className="document-primary" disabled={pending} onClick={onEdit}>{canEdit ? 'Edit document' : 'Edit tags'}</button>}{canDelete && <button disabled={pending} onClick={onDelete}>Delete document</button>}</>}
    {onDownload && <button type="button" disabled={pending} onClick={onDownload}>Download</button>}
  </div>
}
