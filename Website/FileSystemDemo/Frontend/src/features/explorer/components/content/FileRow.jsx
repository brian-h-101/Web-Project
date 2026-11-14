import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import { getNodePath } from '../../model/fileNode.js'
import { formatDate, formatFileSize, formatFileType } from '../../utils/fileFormatting.js'
import FileIcon from './FileIcon.jsx'

export default function FileRow({ node, selection, onOpen, onContextMenu, onDragStart, onDrop, showPath }) {
  const { nodes, clipboard, location } = useExplorerContext()
  const selected = selection.selectedNodeIds.includes(node.id)
  const cut = clipboard.operation === 'cut' && clipboard.nodeIds.includes(node.id)
  return <tr className={'file-row ' + (selected ? 'selected ' : '') + (cut ? 'cut' : '')} tabIndex={0} aria-selected={selected} data-node-id={node.id}
    draggable={location !== 'recycle'} onDragStart={event => onDragStart(event, node)}
    onDragOver={event => { if (node.type === 'folder' && location !== 'recycle' && event.dataTransfer.types.includes('application/x-file-system-simulator')) { event.preventDefault(); event.stopPropagation() } }}
    onDrop={event => { if (node.type === 'folder' && location !== 'recycle') onDrop(event, node.id) }}
    onClick={event => selection.selectNode(node.id, event)} onDoubleClick={() => onOpen(node)}
    onContextMenu={event => onContextMenu(event, node)}
    onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); selection.selectNode(node.id, event) } }}>
    <td><div className="file-name"><FileIcon node={node} /><div><span>{node.name}</span>{node.status === 'DRAFT' && <small>Draft</small>}{showPath && <small>{getNodePath(nodes, node.parentId)}</small>}</div></div></td>
    <td>{formatFileType(node)}</td><td>{node.type === 'folder' ? '—' : formatFileSize(node.size)}</td><td>{formatDate(node.updatedAt)}</td>
  </tr>
}
