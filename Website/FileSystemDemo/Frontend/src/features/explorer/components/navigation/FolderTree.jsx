import FolderTreeNode from './FolderTreeNode.jsx'
import { useExplorerContext } from '../../context/ExplorerContext.jsx'

export default function FolderTree({ onDrop }) {
  const { nodes, rootId } = useExplorerContext()
  const root = nodes.find(node => node.id === rootId)
  return <ul className="folder-tree" aria-label="Folder hierarchy">{root && <FolderTreeNode node={root} depth={0} onDrop={onDrop} />}</ul>
}
