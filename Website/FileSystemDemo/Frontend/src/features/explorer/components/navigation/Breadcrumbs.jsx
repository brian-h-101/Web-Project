import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'
import usePermissions from '../../../auth/hooks/usePermissions.js'

export default function Breadcrumbs() {
  const { nodes, currentFolderId, location } = useExplorerContext()
  const { openFolder } = useExplorerNavigation()
  const { hasPermission } = usePermissions()
  const ancestors = []
  const visited = new Set()
  let node = nodes.find(item => item.id === currentFolderId)
  while (node && !visited.has(node.id)) { visited.add(node.id); ancestors.unshift(node); node = nodes.find(item => item.id === node.parentId) }
  if (location !== 'files') return <span className="location-crumb">{{ home: 'Home', recent: 'Recent', recycle: 'Recycle Bin' }[location]}</span>
  return <nav className="breadcrumbs" aria-label="Breadcrumbs">{ancestors.map((item, index) =>
    <span key={item.id}><button onClick={() => openFolder(item.id)} aria-current={item.id === currentFolderId ? 'location' : undefined}>{index === 0 ? hasPermission('nodes:create') ? 'Shared files' : 'Published files' : item.name}</button>{index < ancestors.length - 1 && <span aria-hidden="true">›</span>}</span>)}</nav>
}
