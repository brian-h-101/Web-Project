import { useEffect, useRef, useState } from 'react'
import { createTag, renameTag, removeTag } from '../../api/tagApi.js'
export default function CreateTagDialog({ tag = null, onClose, canDelete = false }) {
  const dialog = useRef(null), [name, setName] = useState(tag?.name || ''), [pending, setPending] = useState(false), [error, setError] = useState(null), [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { dialog.current.showModal() }, [])
  const submit = async event => {
    event.preventDefault(); setPending(true); setError(null)
    try { if (confirmDelete) await removeTag(tag.id, tag.revision); else if (tag) await renameTag(tag.id, name, tag.revision); else await createTag(name); onClose() }
    catch (failure) { setError(failure.message) } finally { setPending(false) }
  }
  return <dialog className="document-dialog" ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) onClose() }} aria-labelledby="tag-dialog-title"><form onSubmit={submit}>
    <h2 id="tag-dialog-title">{confirmDelete ? 'Delete shared tag?' : tag ? 'Manage shared tag' : 'Create reusable tag'}</h2>
    {confirmDelete ? <p>Delete “{tag.name}”? Remove every product and document assignment first. Referenced tags cannot be deleted.</p> : <label>Tag name<input autoFocus maxLength={80} required disabled={pending} value={name} onChange={event => setName(event.target.value)} /></label>}
    {tag && !confirmDelete && <p>Renaming this tag updates its display across all assigned documents.</p>}
    {error && <p role="alert" className="document-error">{error}</p>}
    <div className="document-actions"><button type="button" disabled={pending} onClick={onClose}>Cancel</button>{tag && canDelete && !confirmDelete && <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete tag…</button>}<button className="document-primary" disabled={pending}>{pending ? 'Saving…' : confirmDelete ? 'Confirm deletion' : tag ? 'Rename tag' : 'Create tag'}</button></div>
  </form></dialog>
}
