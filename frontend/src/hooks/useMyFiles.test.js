import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMyFiles, { PAGE_SIZE } from './useMyFiles';
import { listMyFiles } from '../services/api';

vi.mock('../services/api', () => ({
  listMyFiles: vi.fn(),
}));

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function page(items, total) {
  return jsonResponse({ items, total });
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  listMyFiles.mockReset();
});

describe('useMyFiles', () => {
  it('defaults to PAGE_SIZE and fetches offset 0 on mount', async () => {
    listMyFiles.mockResolvedValue(page([{ short_id: 'a' }], 1));
    const { result } = renderHook(() => useMyFiles());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(listMyFiles).toHaveBeenCalledWith(PAGE_SIZE, 0, expect.objectContaining({ signal: expect.anything() }));
    expect(result.current.items).toEqual([{ short_id: 'a' }]);
    expect(result.current.total).toBe(1);
  });

  it('does not fetch at all while enabled is false', async () => {
    listMyFiles.mockResolvedValue(page([], 0));
    renderHook(() => useMyFiles(20, { enabled: false }));

    await act(async () => { await Promise.resolve(); });
    expect(listMyFiles).not.toHaveBeenCalled();
  });

  it('surfaces a non-OK response as status "error" with a message from the body', async () => {
    listMyFiles.mockResolvedValue(jsonResponse({ detail: 'Server exploded' }, 500));
    const { result } = renderHook(() => useMyFiles(20));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Server exploded');
    expect(result.current.items).toEqual([]);
  });

  it('surfaces a rejected fetch (offline) as a network error message', async () => {
    listMyFiles.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useMyFiles(20));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/check your connection/i);
  });

  it('leaves status "loading" and throws nothing when apiFetch swallows a 401 (resolves undefined)', async () => {
    listMyFiles.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMyFiles(20));

    // Give the microtask queue a turn; nothing should throw and status must
    // not flip to 'ready' or 'error' off an undefined response.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.status).toBe('loading');
    expect(result.current.error).toBe('');
  });

  it('reload() refetches the current offset', async () => {
    listMyFiles.mockResolvedValue(page([{ short_id: 'a' }], 1));
    const { result } = renderHook(() => useMyFiles(20));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    listMyFiles.mockClear();
    listMyFiles.mockResolvedValue(page([{ short_id: 'a' }], 1));
    act(() => result.current.reload());

    await waitFor(() => expect(listMyFiles).toHaveBeenCalledTimes(1));
    expect(listMyFiles.mock.calls[0][1]).toBe(0);
  });

  it('goTo(offset) fetches the requested page', async () => {
    listMyFiles.mockResolvedValue(page([{ short_id: 'a' }], 40));
    const { result } = renderHook(() => useMyFiles(20));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    listMyFiles.mockClear();
    listMyFiles.mockResolvedValue(page([{ short_id: 'b' }], 40));
    act(() => result.current.goTo(20));

    await waitFor(() => expect(result.current.offset).toBe(20));
    await waitFor(() => expect(listMyFiles).toHaveBeenCalledWith(20, 20, expect.anything()));
  });

  it('patchItem merges fields into the matching row in place, with no refetch', async () => {
    listMyFiles.mockResolvedValue(page([{ short_id: 'a', has_password: false }], 1));
    const { result } = renderHook(() => useMyFiles(20));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    listMyFiles.mockClear();
    act(() => result.current.patchItem('a', { has_password: true }));

    expect(result.current.items).toEqual([{ short_id: 'a', has_password: true }]);
    expect(listMyFiles).not.toHaveBeenCalled();
  });

  it('removeItem drops the row and decrements total, with no refetch', async () => {
    listMyFiles.mockResolvedValue(page([{ short_id: 'a' }, { short_id: 'b' }], 2));
    const { result } = renderHook(() => useMyFiles(20));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    listMyFiles.mockClear();
    act(() => result.current.removeItem('a'));

    expect(result.current.items).toEqual([{ short_id: 'b' }]);
    expect(result.current.total).toBe(1);
    expect(listMyFiles).not.toHaveBeenCalled();
  });

  it('reloadAfterDelete steps back one page when the deleted row was the last on the page', async () => {
    // Page size 1: two rows across two pages. Land on page 2 (offset 1),
    // delete its only row, and expect a step-back refetch of page 1.
    listMyFiles.mockResolvedValueOnce(page([{ short_id: 'a' }], 2));
    const { result } = renderHook(() => useMyFiles(1));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    listMyFiles.mockResolvedValueOnce(page([{ short_id: 'b' }], 2));
    act(() => result.current.goTo(1));
    await waitFor(() => expect(result.current.offset).toBe(1));
    await waitFor(() => expect(result.current.items).toEqual([{ short_id: 'b' }]));

    // The delete already happened server-side; refetching offset 1 now comes
    // back empty even though there is still a row on offset 0.
    listMyFiles.mockResolvedValueOnce(page([], 1));
    listMyFiles.mockResolvedValueOnce(page([{ short_id: 'a' }], 1));
    act(() => result.current.reloadAfterDelete());

    await waitFor(() => expect(result.current.offset).toBe(0));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([{ short_id: 'a' }]);
  });

  it('discards a stale response when a newer page request resolves out of order', async () => {
    listMyFiles.mockResolvedValueOnce(page([{ short_id: 'page0' }], 60));
    const { result } = renderHook(() => useMyFiles(20));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const stale = deferred();
    const fresh = deferred();
    listMyFiles.mockImplementationOnce(() => stale.promise);
    listMyFiles.mockImplementationOnce(() => fresh.promise);

    act(() => result.current.goTo(20));
    act(() => result.current.goTo(40));

    // The fresher request (offset 40) settles first...
    fresh.resolve(page([{ short_id: 'page40' }], 60));
    await waitFor(() => expect(result.current.items).toEqual([{ short_id: 'page40' }]));

    // ...and the stale one (offset 20) settling afterwards must not overwrite it.
    stale.resolve(page([{ short_id: 'page20' }], 60));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.items).toEqual([{ short_id: 'page40' }]);
    expect(result.current.offset).toBe(40);
  });
});
