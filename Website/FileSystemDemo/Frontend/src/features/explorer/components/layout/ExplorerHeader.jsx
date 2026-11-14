import useExplorerNavigation from '../../hooks/useExplorerNavigation.js'
import AddressBar from '../navigation/AddressBar.jsx'
import ExplorerSearch from '../commands/ExplorerSearch.jsx'
import FileIcon from '../content/FileIcon.jsx'

export default function ExplorerHeader() {
  const navigation = useExplorerNavigation()
  return <header className="explorer-header">
    <div className="title-bar"><FileIcon node={{ type: 'folder' }} /><h2>File Explorer</h2><span className="simulation-label">Folders and files</span></div>
    <div className="navigation-bar"><nav aria-label="Folder navigation" className="navigation-buttons">
      <button aria-label="Back" title="Back" disabled={!navigation.canGoBack} onClick={navigation.navigateBack}>←</button>
      <button aria-label="Forward" title="Forward" disabled={!navigation.canGoForward} onClick={navigation.navigateForward}>→</button>
      <button aria-label="Up" title="Up one folder" disabled={!navigation.canGoUp} onClick={navigation.navigateUp}>↑</button>
    </nav><AddressBar /><ExplorerSearch /></div>
  </header>
}
