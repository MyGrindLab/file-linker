import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileCard from './FileCard';

// This whole file deliberately avoids @testing-library/user-event: setting up
// a userEvent instance replaces `navigator.clipboard`, so a pre-installed
// `vi.fn()` spy on `writeText` never fires. `fireEvent.click` is used
// everywhere instead so the copy-link tests actually exercise the spy.

const BASE_FILE = {
  short_id: 'abc123',
  original_filename: 'holiday-photo.jpg',
  size_bytes: 1468006,
  uploaded_at: '2026-03-12T10:00:00Z',
  expires_at: null,
  has_password: false,
  is_active: true,
  link: 'https://filelinker.test/f/abc123',
};

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('FileCard', () => {
  it('renders the file name, formatted size and upload date', () => {
    render(<FileCard file={BASE_FILE} />);
    expect(screen.getByText('holiday-photo.jpg')).toBeInTheDocument();
    expect(screen.getByText(/1\.4 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Uploaded 12 Mar 2026/)).toBeInTheDocument();
  });

  it('shows a "Protected" pill only when the file has a password', () => {
    const { rerender } = render(<FileCard file={BASE_FILE} />);
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();

    rerender(<FileCard file={{ ...BASE_FILE, has_password: true }} />);
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows an expiry pill derived from expiryLabel for a file that expires', () => {
    // 6.5 days out, not 6, so floor() can't land on a boundary and flake.
    const expiresAt = new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000).toISOString();
    render(<FileCard file={{ ...BASE_FILE, expires_at: expiresAt }} />);
    expect(screen.getByText('Expires in 6 days')).toBeInTheDocument();
  });

  it('shows a "Permanent" pill when the file never expires', () => {
    render(<FileCard file={{ ...BASE_FILE, expires_at: null }} />);
    expect(screen.getByText('Permanent')).toBeInTheDocument();
  });

  it('dims the row and disables every action button when the file is inactive', () => {
    render(<FileCard file={{ ...BASE_FILE, is_active: false }} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replace contents of/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /manage password for/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^delete/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^copy/i })).toBeDisabled();
  });

  it('calls onReplace, onPassword and onDelete with the file when their buttons are pressed', () => {
    const onReplace = vi.fn();
    const onPassword = vi.fn();
    const onDelete = vi.fn();
    render(
      <FileCard file={BASE_FILE} onReplace={onReplace} onPassword={onPassword} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByRole('button', { name: /replace contents of/i }));
    fireEvent.click(screen.getByRole('button', { name: /manage password for/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete/i }));

    expect(onReplace).toHaveBeenCalledWith(BASE_FILE);
    expect(onPassword).toHaveBeenCalledWith(BASE_FILE);
    expect(onDelete).toHaveBeenCalledWith(BASE_FILE);
  });

  it('copies the link to the clipboard and shows "Copied", resetting back to "Copy" after ~1.5s', async () => {
    render(<FileCard file={BASE_FILE} />);

    fireEvent.click(screen.getByRole('button', { name: /^copy/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(BASE_FILE.link);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());

    // Real timers throughout (no vi.useFakeTimers() + fireEvent/userEvent
    // combo, which hangs) — just wait out the real 1.5s reset with headroom.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /^copy link to/i })).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
