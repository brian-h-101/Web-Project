import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { isDocumentFile } from '../features/documents/model/documentModel.js';
import {
  ExplorerProvider,
  useExplorerContext,
} from '../features/explorer/context/ExplorerContext.jsx';
import useExplorerNavigation from '../features/explorer/hooks/useExplorerNavigation.js';
import useDirectory from '../features/explorer/hooks/useDirectory.js';
import useFileSelection from '../features/explorer/hooks/useFileSelection.js';
import useFileOperations from '../features/explorer/hooks/useFileOperations.js';
import useExplorerClipboard from '../features/explorer/hooks/useExplorerClipboard.js';
import ExplorerLayout from '../features/explorer/components/layout/ExplorerLayout.jsx';
import FileContextMenu from '../features/explorer/components/commands/FileContextMenu.jsx';
import NewFolderDialog from '../features/explorer/components/dialogs/NewFolderDialog.jsx';
import RenameDialog from '../features/explorer/components/dialogs/RenameDialog.jsx';
import DeleteDialog from '../features/explorer/components/dialogs/DeleteDialog.jsx';
import PropertiesDialog from '../features/explorer/components/dialogs/PropertiesDialog.jsx';
import FilePreview from '../features/explorer/components/content/FilePreview.jsx';
import usePermissions from '../features/auth/hooks/usePermissions.js';
import { publishNode } from '../features/explorer/api/explorerApi.js';

function ExplorerInterface() {
  const navigate = useNavigate();
  const state = useExplorerContext();
  const { setSelectedNodeIds } = state;
  const navigation = useExplorerNavigation();
  const directory = useDirectory();
  const selection = useFileSelection(directory.entries);
  const operations = useFileOperations();
  const clipboard = useExplorerClipboard();
  const { hasPermission, hasPermissions } = usePermissions();
  const uploadInput = useRef(null);
  const selected = state.nodes.filter((node) => state.selectedNodeIds.includes(node.id));
  const writable =
    hasPermission('nodes:create') &&
    state.connected &&
    !state.isMutating &&
    !directory.isLoading &&
    !directory.error &&
    state.location === 'files' &&
    !state.searchQuery;
  const editableSelection =
    state.connected &&
    !state.isMutating &&
    !directory.error &&
    state.location !== 'recycle' &&
    selected.length > 0;
  const canCut = editableSelection && hasPermissions('nodes:update', 'nodes:create');
  const canCopy = editableSelection && hasPermissions('nodes:read', 'nodes:create');
  const canRename = editableSelection && hasPermission('nodes:update');
  const canDelete = editableSelection && hasPermission('nodes:delete');
  useEffect(() => {
    if (directory.isLoading || directory.error) return;
    const ids = directory.entries.map((node) => node.id);
    setSelectedNodeIds((previous) =>
      previous.every((id) => ids.includes(id))
        ? previous
        : previous.filter((id) => ids.includes(id)),
    );
  }, [directory.entries, directory.isLoading, directory.error, setSelectedNodeIds]);
  const openNode = (node) => {
    if (node.type === 'folder') navigation.openFolder(node.id);
    else if (isDocumentFile(node) && hasPermission('documents:read'))
      navigate('/documents/' + node.id);
    else state.setPreviewNodeId(node.id);
  };
  const showDialog = (type) => {
    state.setContextMenu(null);
    state.setActiveDialog({ type, nodeIds: [...state.selectedNodeIds] });
  };
  const actions = {
    open: () => selected.length === 1 && openNode(selected[0]),
    newFolder: () => writable && showDialog('new'),
    newFile: () => writable && showDialog('newFile'),
    newDocument: () =>
      writable &&
      hasPermission('documents:create') &&
      navigate(
        '/documents?create=1&parentId=' +
          encodeURIComponent(
            selected.length === 1 && selected[0].type === 'folder'
              ? selected[0].id
              : state.currentFolderId,
          ),
      ),
    rename: () => canRename && selected.length === 1 && showDialog('rename'),
    delete: () => canDelete && showDialog('delete'),
    properties: () => selected.length === 1 && showDialog('properties'),
    cut: () => canCut && clipboard.cut(),
    copy: () => canCopy && clipboard.copy(),
    paste: () => writable && clipboard.paste(),
    upload: () => writable && uploadInput.current.click(),
    download: () => selected.length === 1 && operations.downloadFile(selected[0].id),
    showInFolder: () => selected.length === 1 && navigation.openFolder(selected[0].parentId),
  };
  useEffect(() => {
    const handleKey = (event) => {
      if (
        event.target.closest('input, textarea, select, [contenteditable="true"], dialog') ||
        state.activeDialog ||
        state.previewNodeId
      )
        return;
      if (event.defaultPrevented || event.altKey) return;
      const modifier = event.ctrlKey || event.metaKey;
      let action;
      if (modifier && event.key.toLowerCase() === 'c') action = actions.copy;
      if (modifier && event.key.toLowerCase() === 'x') action = actions.cut;
      if (modifier && event.key.toLowerCase() === 'v') action = actions.paste;
      if (event.key === 'Delete') action = actions.delete;
      if (event.key === 'F2') action = actions.rename;
      if (event.key === 'Enter' && !event.target.closest('button, a')) action = actions.open;
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
  const onContextMenu = (event, node) => {
    event.preventDefault();
    if (node && !state.selectedNodeIds.includes(node.id)) state.setSelectedNodeIds([node.id]);
    if (!node) selection.clearSelection();
    state.setContextMenu({ x: event.clientX, y: event.clientY });
  };
  const onDragStart = (event, node) => {
    if (state.location === 'recycle' || !hasPermissions('nodes:read', 'nodes:create')) {
      event.preventDefault();
      return;
    }
    const ids = state.selectedNodeIds.includes(node.id) ? state.selectedNodeIds : [node.id];
    state.setSelectedNodeIds(ids);
    event.dataTransfer.setData('application/x-file-system-simulator', JSON.stringify(ids));
    event.dataTransfer.effectAllowed = hasPermission('nodes:update') ? 'copyMove' : 'copy';
  };
  const onDrop = (event, folderId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!writable) return;
    try {
      const payload = event.dataTransfer.getData('application/x-file-system-simulator');
      if (!payload) return;
      const ids = JSON.parse(payload);
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string'))
        throw new Error('Invalid simulated file selection.');
      if (event.ctrlKey || event.metaKey || !hasPermission('nodes:update'))
        operations.copyNode(ids, folderId);
      else operations.moveNode(ids, folderId);
    } catch (error) {
      state.setFeedback({ type: 'error', message: error.message });
    }
  };
  const toggleSelectedPublication = async () => {
    try {
      const node = selected[0];
      const saved = await publishNode(
        node.id,
        node.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
        node.revision,
      );
      await state.synchronize([saved], [saved.parentId]);
    } catch (e) {
      state.setFeedback({ type: 'error', message: e.message });
    }
  };
  const uploadSelectedFile = async (event) => {
    const file = event.target.files[0];
    if (writable && file) await operations.uploadFile(file);
    event.target.value = '';
  };
  const closeDialog = () => state.setActiveDialog(null);
  const dialog = state.activeDialog;
  const dialogNode = dialog && state.nodes.find((node) => node.id === dialog.nodeIds[0]);
  return (
    <>
      {hasPermission('nodes:update') && (
        <div className="publication-bar">
          <span>
            New items are drafts. Select a folder or file to change publication; publish parents
            first.
          </span>
          {selected.length === 1 && (
            <button onClick={toggleSelectedPublication}>
              {selected[0].status === 'PUBLISHED'
                ? 'Unpublish selected subtree'
                : 'Publish selected item'}
            </button>
          )}
        </div>
      )}
      <ExplorerLayout
        directory={directory}
        selection={selection}
        actions={actions}
        capabilities={{
          writable,
          canCreateDocument: writable && hasPermission('documents:create'),
          editableSelection,
          canCut,
          canCopy,
          canRename,
          canDelete,
          single: selected.length === 1,
          canPaste: clipboard.canPaste,
        }}
        onOpen={openNode}
        onContextMenu={onContextMenu}
        onDragStart={onDragStart}
        onDrop={onDrop}
      />
      {writable && (
        <input
          ref={uploadInput}
          className="visually-hidden"
          type="file"
          accept=".md,.txt,.pdf"
          aria-label="Choose file to upload"
          onChange={uploadSelectedFile}
        />
      )}
      {state.contextMenu && (
        <FileContextMenu
          actions={actions}
          writable={writable}
          editableSelection={editableSelection}
          canCut={canCut}
          canCopy={canCopy}
          canRename={canRename}
          canDelete={canDelete}
          canPaste={clipboard.canPaste}
          selected={selected}
        />
      )}
      {hasPermission('nodes:create') && dialog?.type === 'new' && (
        <NewFolderDialog onClose={closeDialog} onConfirm={operations.createFolder} />
      )}
      {hasPermission('nodes:create') && dialog?.type === 'newFile' && (
        <NewFolderDialog kind="file" onClose={closeDialog} onConfirm={operations.createFile} />
      )}
      {hasPermission('nodes:update') && dialog?.type === 'rename' && (
        <RenameDialog node={dialogNode} onClose={closeDialog} onConfirm={operations.renameNode} />
      )}
      {hasPermission('nodes:delete') && dialog?.type === 'delete' && (
        <DeleteDialog
          nodes={state.nodes.filter((node) => dialog.nodeIds.includes(node.id))}
          onClose={closeDialog}
          onConfirm={() => operations.deleteNode(dialog.nodeIds)}
        />
      )}
      {dialog?.type === 'properties' && (
        <PropertiesDialog node={operations.getNode(dialog.nodeIds[0])} onClose={closeDialog} />
      )}
      {state.previewNodeId && (
        <FilePreview
          node={state.nodes.find((node) => node.id === state.previewNodeId)}
          onClose={() => state.setPreviewNodeId(null)}
          onDownload={operations.downloadFile}
        />
      )}
    </>
  );
}
export default function ExplorerPage() {
  return (
    <ExplorerProvider>
      <ExplorerInterface />
    </ExplorerProvider>
  );
}
