import { useEffect, useRef } from 'react'
import { useExplorerContext } from '../../context/ExplorerContext.jsx'

export default function FileContextMenu({ actions, writable, editableSelection, canCut, canCopy, canRename, canDelete, canPaste, selected }) {
  const { contextMenu, setContextMenu } = useExplorerContext()
  const menu = useRef(null)
  useEffect(() => {
    menu.current.querySelector('button:not(:disabled)')?.focus()
    const dismiss = event => { if (!menu.current?.contains(event.target)) setContextMenu(null) }
    const keydown = event => {
      if (event.key === 'Escape') setContextMenu(null)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')]
        const index = buttons.indexOf(document.activeElement)
        buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', keydown) }
  }, [setContextMenu])
  const single = selected.length === 1
  const commands = [
    ['Open', actions.open, !single || (selected[0]?.type === 'folder' && !editableSelection)],
    ['Show in folder', actions.showInFolder, !single || !editableSelection],
    ['Cut', actions.cut, !canCut], ['Copy', actions.copy, !canCopy],
    ['Paste', actions.paste, !writable || !canPaste], ['Rename', actions.rename, !single || !canRename],
    ['Delete', actions.delete, !canDelete], ['New folder', actions.newFolder, !writable],
    ['New file', actions.newFile, !writable],
    ['Upload', actions.upload, !writable], ['Download', actions.download, !single || !editableSelection || selected[0]?.type !== 'file'],
    ['Properties', actions.properties, !single],
  ]
  return <div ref={menu} role="menu" aria-label="File actions" className="context-menu"
    style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 410)) }}>
    {commands.map(([label, handler, disabled]) => <button role="menuitem" key={label} disabled={disabled} onClick={() => { setContextMenu(null); handler() }}>{label}{label === 'Download' && disabled && <small>Content unavailable</small>}</button>)}
  </div>
}
