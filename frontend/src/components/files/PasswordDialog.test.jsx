import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordDialog from './PasswordDialog';
import { removeFilePassword, setFilePassword } from '../../services/api';

vi.mock('../../services/api', () => ({
  setFilePassword: vi.fn(),
  removeFilePassword: vi.fn(),
}));

const UNPROTECTED_FILE = { short_id: 'abc123', original_filename: 'notes.txt', has_password: false };
const PROTECTED_FILE = { short_id: 'abc123', original_filename: 'notes.txt', has_password: true };

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
  setFilePassword.mockReset();
  removeFilePassword.mockReset();
});

describe('PasswordDialog — add mode (file.has_password === false)', () => {
  it('blocks the request when the password is shorter than 4 characters', async () => {
    const user = userEvent.setup();
    render(<PasswordDialog file={UNPROTECTED_FILE} onClose={vi.fn()} onUpdated={vi.fn()} />);

    await user.type(screen.getByLabelText('Password'), '123');
    await user.type(screen.getByLabelText('Confirm password'), '123');
    await user.click(screen.getByRole('button', { name: 'Add password' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/must be between 4 and 128 characters/i);
    expect(setFilePassword).not.toHaveBeenCalled();
  });

  it('blocks the request when the password and confirmation do not match', async () => {
    const user = userEvent.setup();
    render(<PasswordDialog file={UNPROTECTED_FILE} onClose={vi.fn()} onUpdated={vi.fn()} />);

    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.type(screen.getByLabelText('Confirm password'), 'incorrect-horse');
    await user.click(screen.getByRole('button', { name: 'Add password' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(setFilePassword).not.toHaveBeenCalled();
  });

  it('on a valid matching password, submits, patches has_password to true and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    setFilePassword.mockResolvedValue(noContentResponse());
    render(<PasswordDialog file={UNPROTECTED_FILE} onClose={onClose} onUpdated={onUpdated} />);

    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Add password' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setFilePassword).toHaveBeenCalledWith('abc123', 'correct-horse');
    expect(onUpdated).toHaveBeenCalledWith('abc123', { has_password: true });
  });
});

describe('PasswordDialog — protected mode (file.has_password === true)', () => {
  it('requires a second click before sending the remove request', async () => {
    const user = userEvent.setup();
    removeFilePassword.mockResolvedValue(noContentResponse());
    render(<PasswordDialog file={PROTECTED_FILE} onClose={vi.fn()} onUpdated={vi.fn()} />);

    const removeButton = screen.getByRole('button', { name: 'Remove password' });
    await user.click(removeButton);

    expect(removeFilePassword).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Click again to remove' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Click again to remove' }));
    await waitFor(() => expect(removeFilePassword).toHaveBeenCalledWith('abc123'));
  });

  it('204 on the second click patches has_password to false and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    removeFilePassword.mockResolvedValue(noContentResponse());
    render(<PasswordDialog file={PROTECTED_FILE} onClose={onClose} onUpdated={onUpdated} />);

    await user.click(screen.getByRole('button', { name: 'Remove password' }));
    await user.click(screen.getByRole('button', { name: 'Click again to remove' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onUpdated).toHaveBeenCalledWith('abc123', { has_password: false });
  });

  it('editing the password field disarms a pending remove confirmation', async () => {
    const user = userEvent.setup();
    render(<PasswordDialog file={PROTECTED_FILE} onClose={vi.fn()} onUpdated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Remove password' }));
    expect(screen.getByRole('button', { name: 'Click again to remove' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New password'), 'a');

    expect(screen.getByRole('button', { name: 'Remove password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Click again to remove' })).not.toBeInTheDocument();
  });

  it('a 404 while removing tells the page the file is missing and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMissing = vi.fn();
    removeFilePassword.mockResolvedValue(jsonResponse(null, 404));
    render(<PasswordDialog file={PROTECTED_FILE} onClose={onClose} onUpdated={vi.fn()} onMissing={onMissing} />);

    await user.click(screen.getByRole('button', { name: 'Remove password' }));
    await user.click(screen.getByRole('button', { name: 'Click again to remove' }));

    await waitFor(() => expect(onMissing).toHaveBeenCalledWith('abc123'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
