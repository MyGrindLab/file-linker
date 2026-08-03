import { useCallback, useEffect, useRef, useState } from 'react';
import { listMyFiles } from '../services/api';
import { readApiError } from '../utils/apiError';

/** Rows per page. The backend caps `limit`, this is the UI's page size. */
export const PAGE_SIZE = 20;

const LOAD_FAILED = 'Could not load your files. Please try again.';
const NETWORK_FAILED = 'Could not reach the server. Check your connection and try again.';

/**
 * @typedef {import('../services/api').FileInfo} FileInfo
 */

/**
 * @typedef {Object} MyFilesState
 * @property {FileInfo[]} items            Current page of files (empty while loading/on error).
 * @property {number} total                Total files the user owns, across all pages.
 * @property {number} offset               Offset of the page currently being shown/fetched.
 * @property {number} limit                Page size.
 * @property {'loading'|'ready'|'error'} status
 * @property {string} error                Message for `status === 'error'`, '' otherwise.
 * @property {() => void} reload           Refetch the current page.
 * @property {() => void} reloadAfterDelete Refetch the current page, stepping back one
 *                                          page when the page came back empty (last row
 *                                          on the last page was deleted).
 * @property {(offset: number) => void} goTo Jump to an offset and fetch it.
 * @property {(shortId: string, partial: Partial<FileInfo>) => void} patchItem
 *                                          Merge fields into one row in place, no refetch.
 * @property {(shortId: string) => void} removeItem
 *                                          Drop one row (and decrement `total`), no refetch.
 */

/**
 * Owns the "my files" list: paging, fetch lifecycle and optimistic row edits.
 *
 * Every fetch gets its own AbortController, aborted when the page changes and on
 * unmount. React 18 StrictMode double-invokes effects in dev, and paging fast
 * enough races two requests, so responses are additionally guarded by a request
 * id — only the newest request is allowed to write state.
 *
 * A 401 is handled inside `apiFetch` (token cleared, page reloaded) and surfaces
 * here as an `undefined` response: the hook returns silently without flipping to
 * the error state, because the document is already going away.
 *
 * @param {number} [limit=PAGE_SIZE]
 * @param {{ enabled?: boolean }} [options] `enabled: false` skips fetching entirely
 *        (used while the auth guard is still deciding, so a logged-out visitor never
 *        fires a doomed request).
 * @returns {MyFilesState}
 */
export default function useMyFiles(limit = PAGE_SIZE, { enabled = true } = {}) {
  // `nonce` bumps to force a refetch of the same offset; `stepBack` marks a
  // post-delete refetch, which is allowed to fall back to the previous page.
  const [page, setPage] = useState({ offset: 0, nonce: 0, stepBack: false });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // Mirror of `items` so removeItem can check membership without depending on it.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (targetOffset, { signal, stepBackWhenEmpty = false }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isStale = () => signal.aborted || requestIdRef.current !== requestId;

    setStatus('loading');
    setError('');

    let res;
    try {
      res = await listMyFiles(limit, targetOffset, { signal });
    } catch {
      // Aborted (unmount / page change) or offline. Only the latter is an error.
      if (isStale()) return;
      setStatus('error');
      setError(NETWORK_FAILED);
      return;
    }

    // apiFetch swallowed a 401: token cleared, window.location.reload() in flight.
    if (!res) return;

    if (!res.ok) {
      const message = await readApiError(res, LOAD_FAILED);
      if (isStale()) return;
      setStatus('error');
      setError(message);
      return;
    }

    let data;
    try {
      data = await res.json();
    } catch {
      if (isStale()) return;
      setStatus('error');
      setError(LOAD_FAILED);
      return;
    }

    if (isStale()) return;

    const nextItems = Array.isArray(data?.items) ? data.items : [];
    const nextTotal = Number.isFinite(data?.total) ? data.total : nextItems.length;

    // Deleting the last row of the last page leaves this page empty while earlier
    // pages still have rows — step back one page and let the effect refetch. Status
    // stays 'loading' so the empty state never flashes.
    if (stepBackWhenEmpty && nextItems.length === 0 && targetOffset > 0) {
      setTotal(nextTotal);
      setPage((prev) => ({
        offset: Math.max(0, targetOffset - limit),
        nonce: prev.nonce + 1,
        stepBack: false,
      }));
      return;
    }

    setItems(nextItems);
    setTotal(nextTotal);
    setStatus('ready');
    setError('');
  }, [limit]);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetchPage(page.offset, { signal: controller.signal, stepBackWhenEmpty: page.stepBack });
    return () => controller.abort();
  }, [enabled, fetchPage, page]);

  const reload = useCallback(() => {
    setPage((prev) => ({ offset: prev.offset, nonce: prev.nonce + 1, stepBack: false }));
  }, []);

  const reloadAfterDelete = useCallback(() => {
    setPage((prev) => ({ offset: prev.offset, nonce: prev.nonce + 1, stepBack: true }));
  }, []);

  const goTo = useCallback((nextOffset) => {
    const safeOffset = Number.isFinite(nextOffset) ? Math.max(0, Math.trunc(nextOffset)) : 0;
    setPage((prev) => (
      prev.offset === safeOffset
        ? { offset: safeOffset, nonce: prev.nonce + 1, stepBack: false }
        : { offset: safeOffset, nonce: prev.nonce, stepBack: false }
    ));
  }, []);

  const patchItem = useCallback((shortId, partial) => {
    if (!shortId || !partial) return;
    setItems((prev) => prev.map((item) => (
      item.short_id === shortId ? { ...item, ...partial } : item
    )));
  }, []);

  const removeItem = useCallback((shortId) => {
    if (!itemsRef.current.some((item) => item.short_id === shortId)) return;
    setItems((prev) => prev.filter((item) => item.short_id !== shortId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    items,
    total,
    offset: page.offset,
    limit,
    status,
    error,
    reload,
    reloadAfterDelete,
    goTo,
    patchItem,
    removeItem,
  };
}
