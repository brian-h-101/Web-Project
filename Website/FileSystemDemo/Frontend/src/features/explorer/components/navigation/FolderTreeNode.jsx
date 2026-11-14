import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'
import useFolderTree from '../../hooks/useFolderTree.js'
import FileIcon from '../content/FileIcon.jsx'

export default function FolderTreeNode({ node, depth, onDrop }) {
  const { currentFolderId, location, connected } = useExplorerContext()
  const navigation = useExplorerNavigation()
  const tree = useFolderTree(node.id)
  const { children, expanded } = tree
  return <li>
    <div className={'tree-node ' + (location === 'files' && currentFolderId === node.id ? 'active' : '')} style={{ paddingLeft: 10 + depth * 16 }}
      onDragOver={event => { if (event.dataTransfer.types.includes('application/x-file-system-simulator')) event.preventDefault() }}
      onDrop={event => onDrop(event, node.id)}>
      {!tree.loaded || children.length || tree.error ? <button disabled={!connected} className="tree-toggle" aria-label={(expanded ? 'Collapse ' : 'Expand ') + node.name} aria-expanded={expanded} onClick={() => expanded ? navigation.collapseTreeNode(node.id) : navigation.expandTreeNode(node.id)}>{expanded ? '⌄' : '›'}</button> : <span className="tree-spacer" />}
      <button disabled={!connected} className="tree-label" onClick={() => navigation.openFolder(node.id)} aria-current={location === 'files' && currentFolderId === node.id ? 'location' : undefined}><FileIcon node={node} /><span>{node.name}</span></button>
    </div>
    {expanded && children.length > 0 && <ul>{children.map(child => <FolderTreeNode key={child.id} node={child} depth={depth + 1} onDrop={onDrop} />)}</ul>}
    {expanded && tree.loading && <span role="status">Loading folders…</span>}
    {expanded && tree.error && <div role="alert">{tree.error}<button onClick={tree.retry}>Retry folder</button></div>}
  </li>
}
