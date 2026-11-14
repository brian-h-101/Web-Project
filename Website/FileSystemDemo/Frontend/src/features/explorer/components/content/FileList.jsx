import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import FileRow from './FileRow.jsx'

export default function FileList(props) {
  const { view, setView } = useExplorerContext()
  return <table className="file-list" aria-label="Files in details view"><thead><tr>
    {[['name', 'Name'], ['type', 'Type'], ['size', 'Size']].map(([id, name]) => <th key={id} scope="col" aria-sort={view.sortBy === id ? (view.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => setView({ ...view, sortBy: id, sortDirection: view.sortBy === id && view.sortDirection === 'asc' ? 'desc' : 'asc' })}>{name}{view.sortBy === id && <span aria-hidden="true">{view.sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>}</button></th>)}
    <th scope="col">Date modified</th>
  </tr></thead><tbody>{props.entries.map(node => <FileRow key={node.id} node={node} {...props} />)}</tbody></table>
}
