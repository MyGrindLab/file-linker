import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReplaceFileDialog from './ReplaceFileDialog';
import { replaceFileContent } from '../../services/api';

vi.mock('../../services/api', () => ({
  replaceFileContent: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { is_paid: false } }),
}));

const FILE = { short_id: 'abc123', original_filename: 'notes.txt' };

function jsonResponse(body, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// The "upgrade" failure path renders a react-router <Link>, so every render
// needs a Router in its tree even when a given test never hits that path.
function renderDialog(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function dropFile(file) {
  const dropZone = screen.getByRole('button', { name: /choose a replacement file/i });
  fireEvent.drop(dropZone, { dataTransfer: { files: [file], types: ['Files'] } });
}

beforeEach(() => {
  replaceFileContent.mockReset();
});

describe('ReplaceFileDialog', () => {
  it('rejects an unsupported file extension before making any request', () => {
    const onClose = vi.fn();
    renderDialog(<ReplaceFileDialog file={FILE} onClose={onClose} onReplaced={vi.fn()} />);

    // userEvent.upload() enforces the <input accept>, so it cannot exercise
    // this path — a drop event bypasses that browser-side filtering.
    dropFile(new File(['MZ'], 'installer.exe', { type: 'application/octet-stream' }));

    expect(screen.getByRole('alert')).toHaveTextContent("That file type isn't supported.");
    expect(replaceFileContent).not.toHaveBeenCalled();
  });

  it('rejects a file over the plan size limit before making any request', () => {
    renderDialog(<ReplaceFileDialog file={FILE} onClose={vi.fn()} onReplaced={vi.fn()} />);

    const oversized = new File(['x'], 'movie.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversized, 'size', { value: 11 * 1024 * 1024 });
    dropFile(oversized);

    expect(screen.getByRole('alert')).toHaveTextContent('File exceeds the 10 MB limit for your plan.');
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toBeInTheDocument();
    expect(replaceFileContent).not.toHaveBeenCalled();
  });

  it('renders a 422 array-of-objects `detail` as a plain string, never "[object Object]"', async () => {
    replaceFileContent.mockResolvedValue(
      jsonResponse(
        { detail: [{ loc: ['body', 'file'], msg: 'Unsupported nested payload', type: 'value_error' }] },
        422
      )
    );
    renderDialog(<ReplaceFileDialog file={FILE} onClose={vi.fn()} onReplaced={vi.fn()} />);

    dropFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: /replace file/i }));

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveTextContent('Unsupported nested payload'));
    expect(alert.textContent).not.toContain('[object Object]');
  });

  it('on success, patches the row with the response body and closes the dialog', async () => {
    const onClose = vi.fn();
    const onReplaced = vi.fn();
    replaceFileContent.mockResolvedValue(
      jsonResponse({ short_id: 'abc123', size_bytes: 42 })
    );
    renderDialog(<ReplaceFileDialog file={FILE} onClose={onClose} onReplaced={onReplaced} />);

    dropFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: /replace file/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onReplaced).toHaveBeenCalledWith('abc123', { short_id: 'abc123', size_bytes: 42 });
  });

  it('on 404, tells the page the file is missing and closes', async () => {
    const onClose = vi.fn();
    const onMissing = vi.fn();
    replaceFileContent.mockResolvedValue(jsonResponse(null, 404));
    renderDialog(<ReplaceFileDialog file={FILE} onClose={onClose} onReplaced={vi.fn()} onMissing={onMissing} />);

    dropFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: /replace file/i }));

    await waitFor(() => expect(onMissing).toHaveBeenCalledWith('abc123'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes the dialog without sending a request', () => {
    const onClose = vi.fn();
    renderDialog(<ReplaceFileDialog file={FILE} onClose={onClose} onReplaced={vi.fn()} />);

    dropFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(replaceFileContent).not.toHaveBeenCalled();
  });
});
