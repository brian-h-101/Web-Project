import { useState } from 'react'
import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'
import Breadcrumbs from './Breadcrumbs.jsx'

export default function AddressBar() {
  const { path, navigateToPath } = useExplorerNavigation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  return <div className="address-bar">
    <span aria-hidden="true" className="address-icon">▣</span>
    {editing ? <form onSubmit={async event => { event.preventDefault(); if (await navigateToPath(draft)) setEditing(false) }}>
      <input aria-label="Folder path" autoFocus value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false) }} />
    </form> : <Breadcrumbs />}
    <button aria-label={editing ? 'Cancel editing address' : 'Edit address'} title={path} onClick={() => { setDraft(path); setEditing(!editing) }}>{editing ? '×' : '⌄'}</button>
  </div>
}
