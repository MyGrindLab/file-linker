import { useCallback, useId, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import Modal from '../Modal';
import { deleteFile } from '../../services/api';
import { formatBytes } from '../../utils/format';
import { readApiError } from '../../utils/apiError';
import { emitToast } from '../../utils/toast';

const FILE_GONE = 'This file no longer exists.';
const RATE_LIMITED = 'Too many requests — wait a moment.';
const GENERIC = 'Something went wrong. Please try again.';

/**
 * Confirm deleting one file.
 *
 * Destructive, so Cancel takes the initial focus: Enter on an unread dialog
 * dismisses instead of deleting.
 *
 * On success the list is *refetched* rather than spliced — the backend list is
 * offset-paginated, so dropping a row locally would silently skip the row that
 * shifts up into the page. `onDeleted` is expected to call `reloadAfterDelete`,
 * which also steps back a page when the last row of the last page goes.
 *
 * @typedef {import('../../services/api').FileInfo} FileInfo
 *
 * @typedef {Object} DeleteFileDialogProps
 * @property {FileInfo} file              Row the dialog acts on.
 * @property {() => void} onClose         Dismiss (Esc, backdrop, Cancel, success).
 * @property {(shortId: string) => void} onDeleted   204 handler — refetch the page.
 * @property {(shortId: string) => void} [onMissing]
 *        404 handler: already gone server-side (drop it and refetch).
 *
 * @param {DeleteFileDialogProps} props
 */
export default function DeleteFileDialog({ file, onClose, onDeleted, onMissing }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const cancelRef = useRef(/** @type {HTMLButtonElement|null} */(null));

  const reactId = useId();
  const errorId = `delete-error-${reactId}`;

  const shortId = file?.short_id;
  const name = file?.original_filename || 'Untitled file';

  const handleDelete = useCallback(async () => {
    if (busy || !shortId) return;

    setBusy(true);
    setFailure('');

    let res;
    try {
      res = await deleteFile(shortId);
    } catch {
      setBusy(false);
      setFailure(GENERIC);
      return;
    }

    // apiFetch swallowed a 401: the token is cleared and the page is reloading.
    if (!res) return;

    if (res.ok) {
      emitToast('File deleted.', 'success');
      onClose?.();
      onDeleted?.(shortId);
      return;
    }

    // Already deleted elsewhere — the user's intent is satisfied, so close and
    // let the page drop the stale row.
    if (res.status === 404) {
      emitToast(FILE_GONE);
      onClose?.();
      onMissing?.(shortId);
      return;
    }

    let message;
    if (res.status === 422) message = await readApiError(res, GENERIC);
    else if (res.status === 429) message = RATE_LIMITED;
    else if (res.status === 400) message = await readApiError(res, GENERIC);
    else message = GENERIC;

    // Dialog stays open so the user can retry.
    setBusy(false);
    setFailure(message);
  }, [busy, onClose, onDeleted, onMissing, shortId]);

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Delete this file?"
      description="The link will stop working immediately and the file is removed from storage. This cannot be undone."
      initialFocusRef={cancelRef}
      footer={(
        <>
          <GhostBtn type="button" ref={cancelRef} onClick={onClose} disabled={busy}>
            Cancel
          </GhostBtn>
          <DangerBtn
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-describedby={errorId}
          >
            {busy ? 'Deleting…' : 'Delete file'}
          </DangerBtn>
        </>
      )}
    >
      <Target>
        <Name title={name}>{name}</Name>
        <Meta>{formatBytes(file?.size_bytes)}</Meta>
      </Target>

      <ErrorRegion id={errorId} role="alert">
        {failure}
      </ErrorRegion>
    </Modal>
  );
}

const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }
`;

const Target = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid rgba(24, 57, 42, 0.1);
  border-radius: 10px;
  background: #f8faf9;
`;

const Name = styled.strong`
  font-size: 14px;
  font-weight: 700;
  color: #101b16;
  overflow-wrap: anywhere;
`;

const Meta = styled.span`
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

const DangerBtn = styled.button`
  padding: 10px 20px;
  background: #d32f2f;
  color: #fff;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.3;
  cursor: pointer;
  transition: background 0.15s;
  ${focusRing}

  &:hover:not(:disabled) { background: #b71c1c; }
  &:active:not(:disabled) { background: #a01818; }
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
