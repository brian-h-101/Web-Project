import { useEffect, useRef, useSyncExternalStore } from 'react';
import { DatabaseFeed } from './DatabaseFeed.js';
/**
 * @typedef {import('./DatabaseFeed.js').FeedConfiguration & {revision: number}} DatabaseFeedSettings
 * @typedef {import('./DatabaseFeed.js').FeedSnapshot & {refresh: () => Promise<void>, loadMore: () => Promise<void>}} DatabaseFeedFacade
 */
/**
 * Own one feed per hook instance and bridge its snapshots to React. Effects stay
 * ordered: configure the view, acknowledge visibility revalidation, then register
 * disposal. The returned facade is a new object; feed snapshots are stable until
 * the feed replaces them. Sensitive view/day masking below runs before effects.
 * @param {DatabaseFeedSettings} settings revision acknowledges preview/focus revalidation, not a persisted row revision.
 * @returns {DatabaseFeedFacade} A new facade per render, with read actions over the mounted feed.
 */
export default function useDatabaseFeed(settings) {
  const feedRef = useRef(null);
  if (!feedRef.current) feedRef.current = new DatabaseFeed();
  const feed = feedRef.current,
    state = useSyncExternalStore(feed.subscribe, feed.snapshot);
  useEffect(() => {
    feed.configure(settings);
  }, [
    feed,
    settings.collection,
    settings.scope,
    settings.scopeKey,
    settings.folder,
    settings.selected,
    settings.active,
    settings.auto,
  ]);
  useEffect(() => {
    feed.visibilityRevision = settings.revision;
    if (settings.revision) feed.revalidate();
  }, [feed, settings.revision]);
  useEffect(() => () => feed.dispose(), [feed]);
  // Scope changes never expose a previous access-sensitive render before effect cleanup.
  const scopeChanged = settings.scopeKey !== feed.scopeKey,
    viewChanged = settings.collection !== feed.collection || settings.folder !== feed.folder,
    expired =
      settings.collection === 'orders' && state.updated !== null && feed.reader.remaining() <= 0,
    returning = settings.collection === 'orders' && settings.revision !== feed.visibilityRevision;
  return {
    ...(scopeChanged || viewChanged || expired || returning
      ? {
          ...state,
          rows: [],
          detail: null,
          updated: null,
          highlights: {},
          nextCursor: null,
          incomplete: false,
          error: null,
          note: '',
          phase: 'revalidating',
        }
      : state),
    refresh: () => feed.refresh(),
    loadMore: () => feed.refresh(true),
  };
}
