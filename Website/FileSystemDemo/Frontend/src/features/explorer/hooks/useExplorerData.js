import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/explorerApi.js';
import { getDescendantIds } from '../model/fileNode.js';

// Feature-local data ownership. Navigation, recovery decisions and mutation/UI
// coordination stay in ExplorerProvider; cache/controller refs stay private here.
/**
 * Caches and per-directory pending work live for this provider/hook instance.
 * nodes/directories are React snapshots; nodeCache/directoryCache hold reusable
 * records. The API module's observed revision hints have a separate lifetime.
 * Unmount aborts owned directory reads; it does not clear that API-level map.
 */
export default function useExplorerData(failConnection) {
  const [nodes, setNodes] = useState([]);
  const nodeCache = useRef(new Map());
  const [directories, setDirectories] = useState({});
  const directoryCache = useRef(new Map());
  const requests = useRef(new Map());

  const cacheNodes = useCallback((records) => {
    for (const record of records) nodeCache.current.set(record.id, record);
    setNodes([...nodeCache.current.values()]);
  }, []);

  const loadAncestry = useCallback(
    async (id, signal, currentSearch) => {
      const result = [];
      const visited = new Set();
      while (id !== null) {
        if (visited.has(id)) throw new Error('The backend returned a circular hierarchy.');
        visited.add(id);
        // Reuse only this search's verified snapshot, not arbitrary cached metadata.
        const node = currentSearch?.get(id) || (await api.getNode(id, signal));
        currentSearch?.set(id, node);
        result.unshift(node);
        id = node.parentId;
      }
      if (!signal?.aborted) cacheNodes(result);
      return result;
    },
    [cacheNodes],
  );

  /**
   * Share the exact pending Promise for an id before consulting a successful cache.
   * A forced refresh aborts/replaces that id's entry. Only the current entry may
   * update snapshots, report a non-abort failure or remove pending ownership;
   * callers still receive the original result/rejection, including stale work.
   */
  const loadDirectory = useCallback(
    (id, refresh = false) => {
      if (!id) return Promise.reject(new Error('Connect to the backend first.'));
      if (!refresh && requests.current.has(id)) return requests.current.get(id).promise;
      if (!refresh && directoryCache.current.has(id))
        return Promise.resolve(directoryCache.current.get(id));
      requests.current.get(id)?.controller.abort();
      const controller = new AbortController();
      const entry = { controller };
      setDirectories((previous) => ({
        ...previous,
        [id]: { ...previous[id], loading: true, error: null },
      }));
      entry.promise = api
        .getChildren(id, controller.signal)
        .then((result) => {
          if (requests.current.get(id) !== entry) return result;
          directoryCache.current.set(id, result);
          cacheNodes(result.children);
          setDirectories((previous) => ({
            ...previous,
            [id]: { data: result, loading: false, error: null },
          }));
          return result;
        })
        .catch((error) => {
          if (requests.current.get(id) === entry && error.name !== 'AbortError') {
            setDirectories((previous) => ({
              ...previous,
              [id]: { ...previous[id], loading: false, error },
            }));
            failConnection(error);
          }
          throw error;
        })
        .finally(() => {
          if (requests.current.get(id) === entry) requests.current.delete(id);
        });
      requests.current.set(id, entry);
      return entry.promise;
    },
    [cacheNodes, failConnection],
  );

  const getCachedParent = useCallback((id) => nodeCache.current.get(id)?.parentId, []);
  // Invalidation removes reusable directory results only: it neither aborts
  // pending work nor resets the node/directory snapshots already shown by the UI.
  const clearDirectoryCache = useCallback(() => directoryCache.current.clear(), []);
  const invalidateDirectories = useCallback((ids) => {
    for (const id of ids) directoryCache.current.delete(id);
  }, []);
  // Focus/invalidation probes share pending reads; explicit refresh remains forced.
  const reuseOrRefreshDirectory = useCallback(
    (id) => requests.current.get(id)?.promise || loadDirectory(id, true),
    [loadDirectory],
  );

  // Apply already-returned mutation records locally. Tombstones remove their
  // cached descendants and abort affected reads; this operation performs no write.
  const applyRecords = useCallback((records) => {
    const removed = new Set();
    for (const record of records) {
      if (record.deletedAt)
        for (const id of getDescendantIds([...nodeCache.current.values()], record.id))
          removed.add(id);
      else nodeCache.current.set(record.id, record);
    }
    for (const id of removed) {
      nodeCache.current.delete(id);
      directoryCache.current.delete(id);
      requests.current.get(id)?.controller.abort();
    }
    setNodes([...nodeCache.current.values()]);
    setDirectories((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => !removed.has(id))),
    );
    return removed;
  }, []);

  useEffect(
    () => () => {
      for (const entry of requests.current.values()) entry.controller.abort();
    },
    [],
  );

  return {
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
  };
}
