import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FilesPage from './FilesPage';
import { deleteFile, listMyFiles } from '../services/api';

vi.mock('../services/api', () => ({
  listMyFiles: vi.fn(),
  deleteFile: vi.fn(),
  replaceFileContent: vi.fn(),
  setFilePassword: vi.fn(),
  removeFilePassword: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const USER = { sub: 'user-1', is_paid: false };

function jsonResponse(body, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function page(items, total) {
  return jsonResponse({ items, total });
}

function file(overrides = {}) {
  return {
    short_id: 'file-1',
    original_filename: 'holiday-photo.jpg',
    size_bytes: 12345,
    uploaded_at: '2026-03-12T10:00:00Z',
    expires_at: null,
    has_password: false,
    is_active: true,
    link: 'https://filelinker.test/f/file-1',
    ...overrides,
  };
}

function renderFilesPage() {
  return render(
    <MemoryRouter initialEntries={['/files']}>
      <Routes>
        <Route path="/files" element={<FilesPage />} />
        <Route path="/login" element={<div>Login page placeholder</div>} />
        <Route path="/" element={<div>Home page placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  listMyFiles.mockReset();
  deleteFile.mockReset();
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({ user: USER, logout: vi.fn() });
});

describe('FilesPage — auth guard', () => {
  it('redirects an unauthenticated visitor to /login instead of rendering the list', async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    renderFilesPage();

    await waitFor(() => expect(screen.getByText('Login page placeholder')).toBeInTheDocument());
    expect(listMyFiles).not.toHaveBeenCalled();
  });
});

describe('FilesPage — list states', () => {
  it('shows the loading skeleton while the first page is in flight', () => {
    listMyFiles.mockReturnValue(new Promise(() => {})); // never resolves
    renderFilesPage();

    expect(screen.getByText('Loading your files')).toBeInTheDocument();
  });

  it('renders one row per file returned by listMyFiles, plus the total count', async () => {
    listMyFiles.mockResolvedValue(
      page([file({ short_id: 'a', original_filename: 'a.txt' }), file({ short_id: 'b', original_filename: 'b.txt' })], 2)
    );
    renderFilesPage();

    const list = await screen.findByRole('list', { name: 'Your files' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('shows the empty-state card with an upload link when the user has no files', async () => {
    listMyFiles.mockResolvedValue(page([], 0));
    renderFilesPage();

    expect(await screen.findByText('No files yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload a file' })).toHaveAttribute('href', '/');
  });

  it('shows the error card on failure, and "Try again" refetches successfully', async () => {
    const user = userEvent.setup();
    listMyFiles.mockResolvedValueOnce(jsonResponse({ detail: 'Server exploded' }, 500));
    renderFilesPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Server exploded');

    listMyFiles.mockResolvedValueOnce(page([file()], 1));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('holiday-photo.jpg')).toBeInTheDocument();
    expect(listMyFiles).toHaveBeenCalledTimes(2);
  });

  it('does not throw when the first load hits the swallowed-401 path (listMyFiles resolves undefined)', async () => {
    listMyFiles.mockResolvedValue(undefined);
    renderFilesPage();

    await waitFor(() => expect(listMyFiles).toHaveBeenCalled());
    // Stays on the loading skeleton; the real 401 handler is reloading the
    // page. The only real assertion is "rendering this did not throw".
    expect(screen.getByText('Loading your files')).toBeInTheDocument();
  });
});

describe('FilesPage — pagination', () => {
  it('hides the pagination control when everything fits on one page', async () => {
    listMyFiles.mockResolvedValue(page([file()], 1));
    renderFilesPage();

    await screen.findByText('holiday-photo.jpg');
    expect(screen.queryByRole('navigation', { name: 'Files pagination' })).not.toBeInTheDocument();
  });

  it('Next/Previous drive the limit/offset used for the next fetch', async () => {
    const user = userEvent.setup();
    listMyFiles.mockResolvedValueOnce(page([file({ short_id: 'p1' })], 25));
    renderFilesPage();

    await screen.findByText('Page 1 of 2');

    listMyFiles.mockResolvedValueOnce(page([file({ short_id: 'p2' })], 25));
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(listMyFiles).toHaveBeenLastCalledWith(20, 20, expect.anything()));
    await screen.findByText('Page 2 of 2');

    listMyFiles.mockResolvedValueOnce(page([file({ short_id: 'p1' })], 25));
    await user.click(screen.getByRole('button', { name: 'Previous page' }));

    await waitFor(() => expect(listMyFiles).toHaveBeenLastCalledWith(20, 0, expect.anything()));
  });
});

describe('FilesPage — delete flow', () => {
  it('Cancel in the delete dialog sends no request and leaves the row in place', async () => {
    const user = userEvent.setup();
    listMyFiles.mockResolvedValue(page([file()], 1));
    renderFilesPage();

    await screen.findByText('holiday-photo.jpg');
    await user.click(screen.getByRole('button', { name: /^delete holiday-photo\.jpg$/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(deleteFile).not.toHaveBeenCalled();
    expect(screen.getByText('holiday-photo.jpg')).toBeInTheDocument();
  });

  it('confirming delete (204) removes the row from view because the page is refetched', async () => {
    const user = userEvent.setup();
    listMyFiles.mockResolvedValueOnce(page([file()], 1));
    renderFilesPage();

    await screen.findByText('holiday-photo.jpg');
    await user.click(screen.getByRole('button', { name: /^delete holiday-photo\.jpg$/i }));
    deleteFile.mockResolvedValue(new Response(null, { status: 204 }));
    listMyFiles.mockResolvedValueOnce(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('file-1'));
    // The row is gone AND the page was refetched (2nd listMyFiles call), not
    // just spliced out locally.
    await waitFor(() => expect(listMyFiles).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No files yet')).toBeInTheDocument();
  });

  it('a 404 on delete (already gone) drops the stale row from the list', async () => {
    const user = userEvent.setup();
    listMyFiles.mockResolvedValueOnce(page([file()], 1));
    renderFilesPage();

    await screen.findByText('holiday-photo.jpg');
    await user.click(screen.getByRole('button', { name: /^delete holiday-photo\.jpg$/i }));
    deleteFile.mockResolvedValue(jsonResponse(null, 404));
    listMyFiles.mockResolvedValueOnce(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(screen.queryByText('holiday-photo.jpg')).not.toBeInTheDocument());
    expect(await screen.findByText('No files yet')).toBeInTheDocument();
  });
});
