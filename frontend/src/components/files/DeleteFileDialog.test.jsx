import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteFileDialog from './DeleteFileDialog';
import { deleteFile } from '../../services/api';

vi.mock('../../services/api', () => ({
  deleteFile: vi.fn(),
}));

const FILE = { short_id: 'abc123', original_filename: 'notes.txt', size_bytes: 100 };

function jsonResponse(body, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function noContentResponse() {
  return new Response(null, { status: 204 });
}

beforeEach(() => {
  deleteFile.mockReset();
});

describe('DeleteFileDialog', () => {
  it('Cancel closes the dialog and sends no delete request', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DeleteFileDialog file={FILE} onClose={onClose} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('confirming delete on a 204 closes the dialog and tells the page to refetch', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    deleteFile.mockResolvedValue(noContentResponse());
    render(<DeleteFileDialog file={FILE} onClose={onClose} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('abc123'));
    expect(deleteFile).toHaveBeenCalledWith('abc123');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a 404 (already gone) still closes the dialog and reports the row as missing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMissing = vi.fn();
    const onDeleted = vi.fn();
    deleteFile.mockResolvedValue(jsonResponse(null, 404));
    render(<DeleteFileDialog file={FILE} onClose={onClose} onDeleted={onDeleted} onMissing={onMissing} />);

    await user.click(screen.getByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(onMissing).toHaveBeenCalledWith('abc123'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('a non-404 failure keeps the dialog open with an error so the user can retry', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    deleteFile.mockResolvedValue(jsonResponse({ detail: 'Server exploded' }, 500));
    render(<DeleteFileDialog file={FILE} onClose={onClose} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });

  it('a 401 swallowed by apiFetch (deleteFile resolves undefined) does not throw and leaves the dialog as-is', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    deleteFile.mockResolvedValue(undefined);
    render(<DeleteFileDialog file={FILE} onClose={onClose} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete file' }));
    await waitFor(() => expect(deleteFile).toHaveBeenCalledTimes(1));

    // Nothing to assert beyond "did not throw" and "did not fire the success
    // or missing callbacks" — the real 401 handler is already navigating the
    // page away via window.location.reload().
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
