import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import { getNodePath } from '../../model/fileNode.js'
import FileIcon from './FileIcon.jsx'

export default function FileGrid({ entries, selection, onOpen, onContextMenu, onDragStart, onDrop, showPath }) {
  const { nodes, clipboard, location } = useExplorerContext()
  return <div className="file-grid" aria-label="Files in grid view" onClick={event => { if (event.target === event.currentTarget) selection.clearSelection() }}>
    {entries.map(node => <div key={node.id} role="button" tabIndex={0} aria-label={node.name} aria-pressed={selection.selectedNodeIds.includes(node.id)} data-node-id={node.id}
      className={'file-tile ' + (selection.selectedNodeIds.includes(node.id) ? 'selected ' : '') + (clipboard.operation === 'cut' && clipboard.nodeIds.includes(node.id) ? 'cut' : '')}
      draggable={location !== 'recycle'} onDragStart={event => onDragStart(event, node)}
      onDragOver={event => { if (node.type === 'folder' && location !== 'recycle' && event.dataTransfer.types.includes('application/x-file-system-simulator')) { event.preventDefault(); event.stopPropagation() } }}
      onDrop={event => { if (node.type === 'folder' && location !== 'recycle') onDrop(event, node.id) }}
      onClick={event => selection.selectNode(node.id, event)} onDoubleClick={() => onOpen(node)} onContextMenu={event => onContextMenu(event, node)}
      onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); selection.selectNode(node.id, event) } if (event.key === 'Enter') { event.preventDefault(); onOpen(node) } }}>
      <FileIcon node={node} large /><span>{node.name}</span>{showPath && <small>{getNodePath(nodes, node.parentId)}</small>}
    </div>)}
  </div>
}
