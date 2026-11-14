import ExplorerHeader from './ExplorerHeader.jsx'
import ExplorerStatusBar from './ExplorerStatusBar.jsx'
import NavigationSidebar from '../navigation/NavigationSidebar.jsx'
import ExplorerToolbar from '../commands/ExplorerToolbar.jsx'
import FileView from '../content/FileView.jsx'
import { useExplorerContext } from '../../context/ExplorerContext.jsx'

export default function ExplorerLayout({ directory, selection, actions, capabilities, onOpen, onContextMenu, onDragStart, onDrop }) {
  const { feedback, setFeedback } = useExplorerContext()
  return <main className="explorer-app">
    <ExplorerHeader />
    <ExplorerToolbar actions={actions} capabilities={capabilities} />
    {feedback && <div className={'feedback ' + feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>
      <span>{feedback.message}</span><button aria-label="Dismiss message" onClick={() => setFeedback(null)}>×</button>
    </div>}
    <div className="explorer-body">
      <NavigationSidebar onDrop={onDrop} />
      <FileView directory={directory} selection={selection} onOpen={onOpen} onContextMenu={onContextMenu} onDragStart={onDragStart} onDrop={onDrop} />
    </div>
    <ExplorerStatusBar entries={directory.entries} loading={directory.isLoading || directory.isRefreshing} error={directory.error} unavailable={directory.unavailable} />
  </main>
}
