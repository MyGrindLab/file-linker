import { useCallback, useId, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import Modal from '../Modal';
import { removeFilePassword, setFilePassword } from '../../services/api';
import { readApiError } from '../../utils/apiError';
import { emitToast } from '../../utils/toast';

/** Mirrors FilePasswordSet.validate_password in the backend schema. */
const MIN_LENGTH = 4;
const MAX_LENGTH = 128;

const LENGTH_ERROR = `Password must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`;
const MISMATCH_ERROR = 'Passwords do not match.';
const FILE_GONE = 'This file no longer exists.';
const RATE_LIMITED = 'Too many requests — wait a moment.';
const GENERIC = 'Something went wrong. Please try again.';

/**
 * Add, change or remove a file's download password.
 *
 * One component, two modes, chosen from `file.has_password` — the backend has no
 * way to reveal an existing password, so the "protected" mode only ever offers
 * *replace* or *remove*, never "show current".
 *
 * Mounted only while open (the page renders it conditionally), so fields and
 * errors reset on every opening and no typed password survives a close.
 *
 * Validation (trim, 4–128, must match) runs before the request, which makes a
 * 422 from the backend unreachable in practice — it is still mapped, via
 * `readApiError`, in case the contract drifts.
 *
 * @typedef {import('../../services/api').FileInfo} FileInfo
 *
 * @typedef {Object} PasswordDialogProps
 * @property {FileInfo} file                Row the dialog acts on; `has_password` picks the mode.
 * @property {() => void} onClose           Dismiss (Esc, backdrop, Cancel, success).
 * @property {(shortId: string, fields: {has_password: boolean}) => void} onUpdated
 *        204 handler for both set and remove — feed it to `patchItem`.
 * @property {(shortId: string) => void} [onMissing]
 *        404 handler: the row is gone server-side (drop it and refetch).
 *
 * @param {PasswordDialogProps} props
 */
export default function PasswordDialog({ file, onClose, onUpdated, onMissing }) {
  const protectedNow = Boolean(file?.has_password);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  // '' | 'save' | 'remove' — which request is in flight.
  const [pending, setPending] = useState('');
  const [failure, setFailure] = useState(
    /** @type {{message: string, field?: 'password'|'confirm'}|null} */(null)
  );

  const passwordRef = useRef(/** @type {HTMLInputElement|null} */(null));

  const reactId = useId();
  const formId = `password-form-${reactId}`;
  const passwordId = `password-new-${reactId}`;
  const confirmId = `password-confirm-${reactId}`;
  const errorId = `password-error-${reactId}`;

  const busy = pending !== '';
  const shortId = file?.short_id;
  const name = file?.original_filename || 'this file';

  /** Shared non-2xx mapping. Returns true when the dialog handled it by closing. */
  const handleFailure = useCallback(async (res) => {
    if (res.status === 404) {
      emitToast(FILE_GONE);
      onMissing?.(shortId);
      onClose?.();
      return true;
    }

    let message;
    if (res.status === 422) message = await readApiError(res, GENERIC);
    else if (res.status === 429) message = RATE_LIMITED;
    else if (res.status === 400) message = await readApiError(res, GENERIC);
    else message = GENERIC;

    // Dialog stays open with its values so the user can retry.
    setPending('');
    setFailure({ message });
    return false;
  }, [onClose, onMissing, shortId]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (busy || !shortId) return;

    const next = password.trim();
    if (next.length < MIN_LENGTH || next.length > MAX_LENGTH) {
      setFailure({ message: LENGTH_ERROR, field: 'password' });
      passwordRef.current?.focus();
      return;
    }
    if (next !== confirm.trim()) {
      setFailure({ message: MISMATCH_ERROR, field: 'confirm' });
      return;
    }

    setFailure(null);
    setRemoveConfirm(false);
    setPending('save');

    let res;
    try {
      res = await setFilePassword(shortId, next);
    } catch {
      setPending('');
      setFailure({ message: GENERIC });
      return;
    }

    // apiFetch swallowed a 401: the token is cleared and the page is reloading.
    if (!res) return;

    if (!res.ok) {
      await handleFailure(res);
      return;
    }

    onUpdated?.(shortId, { has_password: true });
    emitToast(protectedNow ? 'Password updated.' : 'Password added.', 'success');
    onClose?.();
  }, [busy, confirm, handleFailure, onClose, onUpdated, password, protectedNow, shortId]);

  const handleRemove = useCallback(async () => {
    if (busy || !shortId) return;

    if (!removeConfirm) {
      setRemoveConfirm(true);
      return;
    }

    setFailure(null);
    setPending('remove');

    let res;
    try {
      res = await removeFilePassword(shortId);
    } catch {
      setPending('');
      setFailure({ message: GENERIC });
      return;
    }

    if (!res) return;

    if (!res.ok) {
      await handleFailure(res);
      return;
    }

    onUpdated?.(shortId, { has_password: false });
    emitToast('Password removed.', 'success');
    onClose?.();
  }, [busy, handleFailure, onClose, onUpdated, removeConfirm, shortId]);

  // Editing re-arms the destructive action: no armed "click again" left behind.
  const editPassword = useCallback((event) => {
    setPassword(event.target.value);
    setRemoveConfirm(false);
  }, []);

  const editConfirm = useCallback((event) => {
    setConfirm(event.target.value);
    setRemoveConfirm(false);
  }, []);

  const title = protectedNow ? 'Password protection' : 'Add a password';
  const description = protectedNow
    ? `${name} is protected. The current password can't be shown — set a new one to replace it, or remove protection entirely.`
    : `Anyone with the link to ${name} will have to enter this password before the file opens.`;
  const submitLabel = protectedNow ? 'Update password' : 'Add password';
  const pendingLabel = protectedNow ? 'Updating…' : 'Adding…';

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      initialFocusRef={passwordRef}
      footer={(
        <>
          <GhostBtn type="button" onClick={onClose} disabled={busy}>Cancel</GhostBtn>
          <SaveBtn type="submit" form={formId} disabled={busy}>
            {pending === 'save' ? pendingLabel : submitLabel}
          </SaveBtn>
        </>
      )}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <Field>
          <LabelRow>
            <Label htmlFor={passwordId}>
              {protectedNow ? 'New password' : 'Password'}
            </Label>
            <ToggleBtn
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              disabled={busy}
            >
              {visible ? 'Hide' : 'Show'}
            </ToggleBtn>
          </LabelRow>
          <Input
            id={passwordId}
            ref={passwordRef}
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={editPassword}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            disabled={busy}
            aria-describedby={errorId}
            aria-invalid={failure?.field === 'password' || undefined}
            placeholder="••••••••"
          />
        </Field>

        <Field>
          <Label htmlFor={confirmId}>
            {protectedNow ? 'Confirm new password' : 'Confirm password'}
          </Label>
          <Input
            id={confirmId}
            type={visible ? 'text' : 'password'}
            value={confirm}
            onChange={editConfirm}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            disabled={busy}
            aria-describedby={errorId}
            aria-invalid={failure?.field === 'confirm' || undefined}
            placeholder="••••••••"
          />
        </Field>

        <Hint>{MIN_LENGTH}–{MAX_LENGTH} characters.</Hint>
      </form>

      <ErrorRegion id={errorId} role="alert">
        {failure?.message}
      </ErrorRegion>

      {protectedNow && (
        <RemoveSection>
          {removeConfirm && (
            <ConfirmText>
              Removing the password makes the link open for anyone who has it.
            </ConfirmText>
          )}
          <DangerGhostBtn
            type="button"
            onClick={handleRemove}
            disabled={busy}
            aria-describedby={errorId}
          >
            {pending === 'remove'
              ? 'Removing…'
              : removeConfirm
                ? 'Click again to remove'
                : 'Remove password'}
          </DangerGhostBtn>
        </RemoveSection>
      )}
    </Modal>
  );
}

const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }
`;

const Field = styled.div`
  margin-bottom: 14px;

  /* The hint below the last field supplies the spacing to the error region. */
  &:last-of-type { margin-bottom: 10px; }
`;

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #444;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${p => (p['aria-invalid'] ? '#d32f2f' : '#e0e0e0')};
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
  ${focusRing}

  &:hover:not(:disabled):not(:focus) { border-color: #cfd8d3; }
  &:focus { border-color: #4CAF50; }
  &:disabled { color: #888; background: #f5f5f5; cursor: not-allowed; }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const ToggleBtn = styled.button`
  padding: 0;
  background: none;
  border: none;
  color: #1f7a55;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  ${focusRing}

  &:hover:not(:disabled) { text-decoration: underline; }
  &:active:not(:disabled) { color: #16603f; }
  &:disabled { color: #aab5af; cursor: not-allowed; }

  &:focus-visible { border-radius: 4px; }
`;

/* #7e8f87 rather than the old #aaa — same muted tone as the file card meta and
   readable against white. */
const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: #7e8f87;
`;

/* Always in the DOM (never display:none) so `aria-describedby` stays valid and
   the live region exists before it gets content — an alert inserted at the same
   time as its text is announced unreliably. Empty just collapses its margin. */
const ErrorRegion = styled.p`
  margin: 12px 0 0;
  color: #d32f2f;
  font-size: 13px;
  line-height: 1.5;

  &:empty { margin: 0; }
`;

const RemoveSection = styled.div`
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(24, 57, 42, 0.1);
`;

const ConfirmText = styled.p`
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #d32f2f;
`;

const SaveBtn = styled.button`
  padding: 10px 20px;
  background: #4CAF50;
  color: #fff;
  /* Transparent border rather than none: keeps the same box height as the
     ghost button beside it in the footer row. */
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.3;
  cursor: pointer;
  transition: background 0.15s;
  ${focusRing}

  &:hover:not(:disabled) { background: #43a047; }
  &:active:not(:disabled) { background: #3d8b40; }
  &:disabled { background: #ccc; cursor: not-allowed; }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const GhostBtn = styled.button`
  padding: 10px 20px;
  background: none;
  color: #496052;
  border: 1px solid rgba(24, 57, 42, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.3;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  ${focusRing}

  &:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: rgba(24, 57, 42, 0.3);
  }

  &:active:not(:disabled) { background: #ececec; }
  &:disabled { color: #aab5af; cursor: not-allowed; }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const DangerGhostBtn = styled.button`
  padding: 9px 16px;
  background: none;
  color: #d32f2f;
  border: 1px solid rgba(211, 47, 47, 0.35);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.3;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  ${focusRing}

  &:hover:not(:disabled) {
    background: #fde7e7;
    border-color: rgba(211, 47, 47, 0.5);
  }

  &:active:not(:disabled) { background: #fbd5d5; }
  &:disabled { color: #aab5af; border-color: rgba(24, 57, 42, 0.1); cursor: not-allowed; }

  /* Matches the footer buttons, which the Modal stacks full-width here. */
  @media (max-width: 360px) { width: 100%; }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;
