import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import SortControls from './SortControls.jsx'
import usePermissions from '../../../auth/hooks/usePermissions.js'

export default function ExplorerToolbar({ actions, capabilities }) {
  const { view, setView } = useExplorerContext()
  const { hasPermission } = usePermissions()
  const canManage = ['nodes:create', 'nodes:update', 'nodes:delete'].some(permission => hasPermission(permission))
  const { writable, canCut, canCopy, canRename, canDelete, single, canPaste } = capabilities
  const commands = [
    ['New folder', '＋', 'New', actions.newFolder, !writable],
    ['New file', '＋', 'New file', actions.newFile, !writable],
    ['New Document', '＋', 'New Document', actions.newDocument, !capabilities.canCreateDocument],
    ['Cut', '✂', 'Cut', actions.cut, !canCut],
    ['Copy', '▧', 'Copy', actions.copy, !canCopy],
    ['Paste', '▤', 'Paste', actions.paste, !writable || !canPaste],
    ['Rename', 'I', 'Rename', actions.rename, !canRename || !single],
    ['Delete', '♲', 'Delete', actions.delete, !canDelete],
    ['Upload', '↑', 'Upload', actions.upload, !writable],
  ]
  return <div className="explorer-toolbar" role="toolbar" aria-label="File commands">
    {canManage && commands.map(([title, icon, label, handler, disabled]) => <button key={title} aria-label={title} title={title} onClick={handler} disabled={disabled}><span className="command-icon" aria-hidden="true">{icon}</span>{label}</button>)}
    {canManage && <span className="toolbar-divider" />}<SortControls />
    <button className="view-switch" aria-label={'Switch to ' + (view.mode === 'details' ? 'grid' : 'details') + ' view'} onClick={() => setView({ ...view, mode: view.mode === 'details' ? 'grid' : 'details' })}><span aria-hidden="true">{view.mode === 'details' ? '▦' : '☷'}</span>View: {view.mode === 'details' ? 'Details' : 'Grid'}</button>
  </div>
}
