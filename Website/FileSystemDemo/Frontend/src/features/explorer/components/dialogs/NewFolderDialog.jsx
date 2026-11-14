import { useEffect, useRef, useState } from 'react'

export default function NewFolderDialog({ onClose, onConfirm, kind = 'folder' }) {
  const dialog = useRef(null)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  return <dialog ref={dialog} className="explorer-dialog" aria-labelledby="new-folder-title" onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <form onSubmit={async event => {
      event.preventDefault()
      if (pending) return
      setPending(true)
      try { const result = await onConfirm(name); if (result.ok) onClose(); else setError(result.error) }
      catch (failure) { setError(failure.message) }
      finally { setPending(false) }
    }}>
      <h2 id="new-folder-title">New {kind}</h2><p>Create {kind === 'file' ? 'an empty file' : 'a folder'} in the current virtual directory.</p>
      <label>{kind === 'file' ? 'File' : 'Folder'} name<input autoFocus disabled={pending} value={name} onChange={event => { setName(event.target.value); setError(null) }} aria-invalid={!!error} aria-describedby={error ? 'new-folder-error' : undefined} /></label>
      {error && <p className="dialog-error" id="new-folder-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" disabled={pending} onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create ' + kind}</button></div>
    </form>
  </dialog>
}