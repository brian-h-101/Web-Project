import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'
import FolderTree from './FolderTree.jsx'
import usePermissions from '../../../auth/hooks/usePermissions.js'

export default function NavigationSidebar({ onDrop }) {
  const { location } = useExplorerContext()
  const { openLocation } = useExplorerNavigation()
  const { hasPermission } = usePermissions()
  return <aside className="navigation-sidebar" aria-label="Locations">
    <nav className="location-links">
      {[['home', '⌂', 'Home'], ['recent', '◷', 'Recent'], ['files', '▣', hasPermission('nodes:create') ? 'Shared files' : 'Published files']].map(([id, icon, name]) =>
        <button key={id} className={location === id ? 'active' : ''} aria-current={location === id ? 'location' : undefined} onClick={() => openLocation(id)}><span aria-hidden="true">{icon}</span>{name}</button>)}
    </nav>
    <div className="sidebar-label">Folders</div>
    <FolderTree onDrop={onDrop} />
    <button className={'recycle-link ' + (location === 'recycle' ? 'active' : '')} aria-current={location === 'recycle' ? 'location' : undefined} onClick={() => openLocation('recycle')}><span aria-hidden="true">♲</span>Recycle Bin</button>
  </aside>
}
