import { useEffect, useRef, useState } from 'react'

export default function DeleteDialog({ nodes, onClose, onConfirm }) {
  const dialog = useRef(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  return <dialog ref={dialog} className="explorer-dialog" aria-labelledby="delete-title" onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <form onSubmit={async event => {
      event.preventDefault()
      if (pending) return
      setPending(true)
      try { const result = await onConfirm(); if (result.ok) onClose(); else setError(result.error) }
      catch (failure) { setError(failure.message) }
      finally { setPending(false) }
    }}>
      <h2 id="delete-title">Delete selected items?</h2>
      <p>{nodes.length === 1 ? nodes[0].name : nodes.length + ' selected items'} will be marked deleted. Folders include their contents.</p>
      <p className="dialog-note">This does not affect any files on your computer. Recovery and permanent deletion are not available.</p>
      {error && <p className="dialog-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button autoFocus type="button" disabled={pending} onClick={onClose}>Cancel</button><button className="danger" type="submit" disabled={!nodes.length || pending}>{pending ? 'Deleting…' : 'Delete'}</button></div>
    </form>
  </dialog>
}