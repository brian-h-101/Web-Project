import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import useServerRoot from '../hooks/useServerRoot.js';
import useExplorerData from '../hooks/useExplorerData.js';
import useRefreshEvents from '../../../shared/hooks/useRefreshEvents.js';

/**
 * Reuse the mapped read records rather than introducing another node model.
 * @typedef {ReturnType<typeof import('../api/nodeMapper.js').mapNode>} ExplorerNode
 * @typedef {ReturnType<typeof import('../api/nodeMapper.js').mapDirectory>} ExplorerDirectory
 * @typedef {{version: number, signal: AbortSignal}} NavigationRequest
 * @typedef {'home' | 'recent' | 'files' | 'recycle'} ExplorerLocation
 * @typedef {{folderId: string | null, location: ExplorerLocation}} NavigationEntry
 * @typedef {{backHistory: NavigationEntry[], forwardHistory: NavigationEntry[]}} NavigationHistory
 * @typedef {{mode: 'details' | 'grid', sortBy: 'name' | 'type' | 'size', sortDirection: 'asc' | 'desc'}} ExplorerView
 * @typedef {{nodeIds: string[], operation: 'copy' | 'cut' | null}} ExplorerClipboard
 * @typedef {{type: string, nodeIds: string[]} | null} ExplorerDialog
 * @typedef {{type: 'error' | 'info' | 'success', message: string} | null} ExplorerFeedback
 * @typedef {{x: number, y: number} | null} ExplorerContextMenu
 */
/**
 * Setters accept either a value or React's updater callback with the prior value.
 * @template T
 * @typedef {import('react').Dispatch<import('react').SetStateAction<T>>} StateSetter
 */
/**
 * Provider-lifetime data and UI coordination, exposed through exactly 43 properties.
 * @typedef {object} ExplorerContextValue
 * @property {ExplorerNode[]} nodes Current mapped node snapshot, not the private cache.
 * @property {string | null} rootId Null before a root has been verified.
 * @property {boolean} connected
 * @property {ReturnType<typeof useServerRoot>} connection Includes retry and failure reporting; root/error may be null.
 * @property {Partial<Record<string, {data?: ExplorerDirectory, loading: boolean, error: Error | null}>>} directories Per-folder read state; entries/data may be absent.
 * @property {(id: string | null, refresh?: boolean) => Promise<ExplorerDirectory>} loadDirectory Shares pending work unless forced; read failures reject.
 * @property {(id: string | null, signal?: AbortSignal, currentSearch?: Map<string, ExplorerNode>) => Promise<ExplorerNode[]>} loadAncestry Ordered root-to-node records; failures reject.
 * @property {(records: ExplorerNode[]) => void} cacheNodes
 * @property {(id: string | null) => Promise<void>} recoverFolder Reports handled recovery failures through connection/feedback.
 * @property {(records: ExplorerNode[], parentIds: (string | null)[]) => Promise<Error | undefined>} synchronize Applies returned write records; returns the first non-abort parent-refresh error, not a write rollback.
 * @property {number} revision UI refresh notification, separate from persisted record revisions.
 * @property {string | null} currentFolderId
 * @property {StateSetter<string | null>} setCurrentFolderId
 * @property {string[]} selectedNodeIds
 * @property {StateSetter<string[]>} setSelectedNodeIds
 * @property {NavigationHistory} navigation
 * @property {StateSetter<NavigationHistory>} setNavigation
 * @property {() => NavigationRequest} startNavigation Aborts the previous navigation owner.
 * @property {(request: NavigationRequest) => boolean} isLatestNavigation
 * @property {ExplorerView} view
 * @property {StateSetter<ExplorerView>} setView
 * @property {ExplorerClipboard} clipboard
 * @property {StateSetter<ExplorerClipboard>} setClipboard
 * @property {ExplorerDialog} activeDialog
 * @property {StateSetter<ExplorerDialog>} setActiveDialog
 * @property {string[]} expandedNodeIds
 * @property {StateSetter<string[]>} setExpandedNodeIds
 * @property {ExplorerLocation} location
 * @property {StateSetter<ExplorerLocation>} setLocation
 * @property {string} searchQuery
 * @property {StateSetter<string>} setSearchQuery
 * @property {string | null} previewNodeId
 * @property {StateSetter<string | null>} setPreviewNodeId
 * @property {ExplorerFeedback} feedback
 * @property {StateSetter<ExplorerFeedback>} setFeedback
 * @property {ExplorerContextMenu} contextMenu
 * @property {StateSetter<ExplorerContextMenu>} setContextMenu
 * @property {string | null} selectionAnchorId
 * @property {StateSetter<string | null>} setSelectionAnchorId
 * @property {(records: ExplorerNode[], originFolderId: string | null) => void} selectMutationResults Selects only if navigation stayed in the origin folder.
 * @property {boolean} isMutating
 * @property {() => boolean} beginMutation Returns false if another mutation owns the lock.
 * @property {() => void} endMutation
 */
/** @type {import('react').Context<ExplorerContextValue | null>} */
const ExplorerContext = createContext(null);
/**
 * Compose connection/data ownership with navigation, recovery and UI coordination.
 * The explicit 43-property facade below is the existing consumer contract;
 * useExplorerData keeps its provider-lifetime caches and request refs private.
 */
export function ExplorerProvider({ children }) {
  const connection = useServerRoot();
  const { root, failConnection, retry } = connection;
  const rootId = root?.id ?? null;
  const connected = connection.status === 'connected';
  const {
    nodes,
    directories,
    cacheNodes,
    loadDirectory,
    loadAncestry,
    getCachedParent,
    clearDirectoryCache,
    invalidateDirectories,
    reuseOrRefreshDirectory,
    applyRecords,
  } = useExplorerData(failConnection);
  const retryConnection = useCallback(() => {
    clearDirectoryCache();
    retry();
  }, [clearDirectoryCache, retry]);
  const navigationRequest = useRef(0);
  const navigationAbort = useRef(null);
  const mutationLock = useRef(false);
  const [isMutating, setIsMutating] = useState(false);
  const beginMutation = useCallback(() => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setIsMutating(true);
    return true;
  }, []);
  const endMutation = useCallback(() => {
    mutationLock.current = false;
    setIsMutating(false);
  }, []);
  // Navigation ownership rejects late UI transitions; it is separate from both
  // persisted node revisions and the public revision refresh-notification counter.
  const startNavigation = useCallback(() => {
    navigationAbort.current?.abort();
    const controller = new AbortController();
    navigationAbort.current = controller;
    return { version: ++navigationRequest.current, signal: controller.signal };
  }, []);
  const isLatestNavigation = useCallback(
    (request) => request.version === navigationRequest.current && !request.signal.aborted,
    [],
  );
  const [revision, setRevision] = useState(0);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const currentFolderRef = useRef(currentFolderId);
  useEffect(() => {
    currentFolderRef.current = currentFolderId;
  }, [currentFolderId]);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [navigation, setNavigation] = useState({ backHistory: [], forwardHistory: [] });
  const [view, setView] = useState({ mode: 'details', sortBy: 'name', sortDirection: 'asc' });
  const [clipboard, setClipboard] = useState({ nodeIds: [], operation: null });
  const [activeDialog, setActiveDialog] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState([]);
  const [location, setLocation] = useState('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewNodeId, setPreviewNodeId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const selectMutationResults = useCallback((records, originFolderId) => {
    if (currentFolderRef.current !== originFolderId) return;
    setSelectedNodeIds(
      records
        .filter((node) => !node.deletedAt && node.parentId === originFolderId)
        .map((node) => node.id),
    );
    setSelectionAnchorId(null);
  }, []);
  const recoverFolder = useCallback(
    async (id) => {
      if (currentFolderRef.current !== id) return;
      let candidate = getCachedParent(id) ?? rootId;
      const visited = new Set([id]);
      while (candidate && !visited.has(candidate)) {
        visited.add(candidate);
        try {
          await loadAncestry(candidate);
          if (currentFolderRef.current !== id) return;
          setCurrentFolderId((current) => (current === id ? candidate : current));
          setSelectedNodeIds([]);
          setLocation('files');
          setSearchQuery('');
          setFeedback({
            type: 'error',
            message: 'That folder is no longer available. Returned to an available ancestor.',
          });
          return;
        } catch (error) {
          if (error.status !== 404) {
            failConnection(error);
            setFeedback({ type: 'error', message: error.message });
            return;
          }
          candidate = getCachedParent(candidate) ?? rootId;
        }
      }
    },
    [rootId, getCachedParent, loadAncestry, failConnection],
  );
  // Called after writes: keep returned records, refresh affected parents and return
  // the first non-abort refresh error (or undefined). A failed refresh is not a
  // rollback or permission to replay the already-completed write.
  const synchronize = useCallback(
    async (records, parentIds) => {
      const activeFolderId = currentFolderRef.current;
      const removed = applyRecords(records);
      setExpandedNodeIds((ids) => ids.filter((id) => !removed.has(id)));
      setSelectedNodeIds((ids) => ids.filter((id) => !removed.has(id)));
      setPreviewNodeId((id) => (removed.has(id) ? null : id));
      setClipboard((previous) => ({
        ...previous,
        nodeIds: previous.nodeIds.filter((id) => !removed.has(id)),
      }));
      setNavigation((previous) => ({
        backHistory: previous.backHistory.filter((entry) => !removed.has(entry.folderId)),
        forwardHistory: previous.forwardHistory.filter((entry) => !removed.has(entry.folderId)),
      }));
      if (removed.has(activeFolderId)) {
        const destination = parentIds.find((id) => id && !removed.has(id)) || rootId;
        setCurrentFolderId((id) => (removed.has(id) ? destination : id));
        setLocation('files');
        setSearchQuery('');
      }
      const affected = [...new Set(parentIds.filter((id) => id && !removed.has(id)))];
      invalidateDirectories(affected);
      const results = await Promise.allSettled(affected.map((id) => loadDirectory(id, true)));
      if (activeFolderId && !removed.has(activeFolderId)) {
        try {
          await loadAncestry(activeFolderId);
        } catch (error) {
          if (error.status === 404) await recoverFolder(activeFolderId);
          else failConnection(error);
        }
      }
      setRevision((value) => value + 1);
      return results.find(
        (result) => result.status === 'rejected' && result.reason.name !== 'AbortError',
      )?.reason;
    },
    [
      rootId,
      applyRecords,
      invalidateDirectories,
      loadDirectory,
      loadAncestry,
      recoverFolder,
      failConnection,
    ],
  );
  useEffect(() => {
    if (!connected || !root) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      cacheNodes([root]);
      setCurrentFolderId((id) => id || rootId);
      setExpandedNodeIds((ids) => [...new Set([...ids, rootId])]);
    });
    return () => {
      active = false;
    };
  }, [connected, root, rootId, cacheNodes]);
  const focusBusy = useRef(false);
  const focusRequest = useRef(null);
  useEffect(() => () => focusRequest.current?.abort(), []);
  // This controller suppresses follow-up work from superseded focus cycles;
  // directory reads retain their own sharing/cancellation in useExplorerData.
  const refreshVisible = useCallback(async () => {
    if (!connected) return;
    focusRequest.current?.abort();
    const controller = new AbortController();
    focusRequest.current = controller;
    focusBusy.current = true;
    try {
      const ids = [...new Set([currentFolderId, ...expandedNodeIds].filter(Boolean))];
      await Promise.allSettled(ids.map((id) => reuseOrRefreshDirectory(id)));
      if (controller.signal.aborted) return;
      if (currentFolderId) {
        try {
          await loadAncestry(currentFolderId, controller.signal);
        } catch (error) {
          if (error.status === 404) await recoverFolder(currentFolderId);
          else failConnection(error);
        }
      }
      if (!controller.signal.aborted) setRevision((value) => value + 1);
    } finally {
      if (focusRequest.current === controller) focusBusy.current = false;
    }
  }, [
    connected,
    currentFolderId,
    expandedNodeIds,
    reuseOrRefreshDirectory,
    loadAncestry,
    recoverFolder,
    failConnection,
  ]);
  useRefreshEvents(refreshVisible, focusBusy);
  useEffect(() => () => navigationAbort.current?.abort(), []);
  return (
    <ExplorerContext.Provider
      value={{
        nodes,
        rootId,
        connected,
        connection: { ...connection, retry: retryConnection },
        directories,
        loadDirectory,
        loadAncestry,
        cacheNodes,
        recoverFolder,
        synchronize,
        revision,
        currentFolderId,
        setCurrentFolderId,
        selectedNodeIds,
        setSelectedNodeIds,
        navigation,
        setNavigation,
        startNavigation,
        isLatestNavigation,
        view,
        setView,
        clipboard,
        setClipboard,
        activeDialog,
        setActiveDialog,
        expandedNodeIds,
        setExpandedNodeIds,
        location,
        setLocation,
        searchQuery,
        setSearchQuery,
        previewNodeId,
        setPreviewNodeId,
        feedback,
        setFeedback,
        contextMenu,
        setContextMenu,
        selectionAnchorId,
        setSelectionAnchorId,
        selectMutationResults,
        isMutating,
        beginMutation,
        endMutation,
      }}
    >
      {children}
    </ExplorerContext.Provider>
  );
}
/** @returns {ExplorerContextValue} @throws {Error} When used outside the provider. */
// oxlint-disable-next-line react/only-export-components -- The specified context module owns its consumer hook.
export function useExplorerContext() {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error('Explorer components must be inside ExplorerProvider.');
  return context;
}
