import { useEffect, useRef, useState } from 'react'
export default function SaveConflictDialog({ onReload, onCancel }) {
  const dialog = useRef(null), [confirm, setConfirm] = useState(false)
  useEffect(() => { dialog.current.showModal() }, [])
  return <dialog className="document-dialog" ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="conflict-title"><h2 id="conflict-title">Save conflict</h2>
    <p>A newer revision is already saved. Your unsaved draft is still here.</p>
    {confirm && <p role="alert">Reloading will discard your unsaved draft. Confirm to load the latest server content.</p>}
    <div className="document-actions"><button onClick={onCancel}>Keep my draft</button><button className="document-primary" onClick={() => confirm ? onReload() : setConfirm(true)}>{confirm ? 'Discard draft and reload' : 'Reload latest…'}</button></div>
  </dialog>
}
