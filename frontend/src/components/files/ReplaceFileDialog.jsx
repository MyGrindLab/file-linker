import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import Modal from '../Modal';
import { useAuth } from '../../context/AuthContext';
import { replaceFileContent } from '../../services/api';
import { formatBytes } from '../../utils/format';
import { readApiError } from '../../utils/apiError';
import { emitToast } from '../../utils/toast';

/**
 * Extensions the backend accepts, mirrored from
 * `FileService.IMAGES + VIDEOS + PDF + TEXT` (backend/app/src/domain/services/file.py).
 * Checking them here turns a round-trip 400 into an instant inline message; the
 * backend stays the authority.
 */
const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp4', 'webm', 'ogg', 'mov',
  'pdf',
  'html', 'txt', 'log', 'csv', 'json', 'xml',
];

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** Mirrors REGISTERED_MAX_SIZE_BYTES / PAID_MAX_SIZE_BYTES in backend settings. */
const MAX_MB = { free: 10, paid: 100 };
const MB = 1024 * 1024;

const UNSUPPORTED_TYPE = "That file type isn't supported.";
const FILE_GONE = 'This file no longer exists.';
const RATE_LIMITED = 'Too many requests — wait a moment.';
const GENERIC = 'Something went wrong. Please try again.';

/** "report.final.PDF" -> "pdf"; no extension -> ''. */
function extensionOf(filename) {
  if (typeof filename !== 'string') return '';
  const name = filename.trim().split(/[/\\]/).pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Swap the bytes behind an existing short link.
 *
 * Mounted only while open (the page renders it conditionally), so every opening
 * starts from a clean slate — no stale selection or error from a previous file.
 *
 * @typedef {import('../../services/api').FileInfo} FileInfo
 *
 * @typedef {Object} ReplaceFileDialogProps
 * @property {FileInfo} file                       Row the dialog acts on.
 * @property {() => void} onClose                  Dismiss (Esc, backdrop, Cancel, success).
 * @property {(shortId: string, fields: Partial<FileInfo>|null) => void} onReplaced
 *        200 handler. `fields` is the response body (feed it to `patchItem`);
 *        `null` when the body could not be parsed — refetch instead.
 * @property {(shortId: string) => void} [onMissing]
 *        404 handler: the row is gone server-side (drop it and refetch).
 *
 * @param {ReplaceFileDialogProps} props
 */
export default function ReplaceFileDialog({ file, onClose, onReplaced, onMissing }) {
  // `|| {}` so the dialog degrades to the free-tier limit instead of throwing if
  // it is ever rendered outside AuthProvider (isolated component tests).
  const { user } = useAuth() || {};
  const [selected, setSelected] = useState(/** @type {File|null} */(null));
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  // `upgrade` adds the pricing link (size failures on a free plan only).
  const [failure, setFailure] = useState(
    /** @type {{message: string, upgrade?: boolean}|null} */(null)
  );

  const dropZoneRef = useRef(/** @type {HTMLDivElement|null} */(null));
  const inputRef = useRef(/** @type {HTMLInputElement|null} */(null));

  const reactId = useId();
  const errorId = `replace-error-${reactId}`;
  const hintId = `replace-hint-${reactId}`;

  const isPaid = Boolean(user?.is_paid);
  const limitMb = isPaid ? MAX_MB.paid : MAX_MB.free;
  const shortId = file?.short_id;
  const name = file?.original_filename || 'this file';

  const tooLarge = useCallback(() => ({
    message: `File exceeds the ${limitMb} MB limit for your plan.`,
    upgrade: !isPaid,
  }), [isPaid, limitMb]);

  /** Client-side gate — extension + size, same rules the backend enforces. */
  const accept = useCallback((candidate) => {
    if (!candidate) return;
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(candidate.name))) {
      setSelected(null);
      setFailure({ message: UNSUPPORTED_TYPE });
      return;
    }
    if (candidate.size > limitMb * MB) {
      setSelected(null);
      setFailure(tooLarge());
      return;
    }
    setFailure(null);
    setSelected(candidate);
  }, [limitMb, tooLarge]);

  const openPicker = useCallback(() => {
    if (busy) return;
    inputRef.current?.click();
  }, [busy]);

  const handleKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    openPicker();
  }, [openPicker]);

  const handleInputChange = useCallback((event) => {
    accept(event.target.files?.[0] || null);
    // Allow re-picking the same file after a rejection.
    event.target.value = '';
  }, [accept]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    if (!busy) setDragging(true);
  }, [busy]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    accept(event.dataTransfer?.files?.[0] || null);
  }, [accept, busy]);

  const handleSubmit = useCallback(async () => {
    if (!selected || busy || !shortId) return;

    setBusy(true);
    setFailure(null);

    let res;
    try {
      res = await replaceFileContent(shortId, selected);
    } catch {
      setBusy(false);
      setFailure({ message: GENERIC });
      return;
    }

    // apiFetch swallowed a 401: the token is cleared and the page is reloading.
    if (!res) return;

    if (res.ok) {
      let body = null;
      try {
        const data = await res.json();
        if (data && typeof data === 'object' && !Array.isArray(data)) body = data;
      } catch {
        body = null;
      }
      onReplaced?.(shortId, body);
      emitToast('File contents replaced.', 'success');
      onClose?.();
      return;
    }

    if (res.status === 404) {
      emitToast(FILE_GONE);
      onMissing?.(shortId);
      onClose?.();
      return;
    }

    let next;
    if (res.status === 400) next = { message: UNSUPPORTED_TYPE };
    else if (res.status === 413) next = tooLarge();
    else if (res.status === 422) next = { message: await readApiError(res, GENERIC) };
    else if (res.status === 429) next = { message: RATE_LIMITED };
    else next = { message: GENERIC };

    // Selection and dialog survive: the user can retry without re-picking.
    setBusy(false);
    setFailure(next);
  }, [busy, onClose, onMissing, onReplaced, selected, shortId, tooLarge]);

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Replace file contents"
      description="The link stays the same."
      initialFocusRef={dropZoneRef}
      footer={(
        <>
          <GhostBtn type="button" onClick={onClose} disabled={busy}>Cancel</GhostBtn>
          <SaveBtn type="button" onClick={handleSubmit} disabled={busy || !selected}>
            {busy ? 'Replacing…' : 'Replace file'}
          </SaveBtn>
        </>
      )}
    >
      <Note>
        The previous version is permanently deleted, and the new file may be a
        different type.
      </Note>

      {/* Sibling, not a child of the drop zone: a programmatic .click() on the
          input bubbles, and inside the zone it would re-enter its onClick. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleInputChange}
        disabled={busy}
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
      />

      <DropZone
        ref={dropZoneRef}
        role="button"
        tabIndex={0}
        aria-label={
          selected
            ? `Replacement for ${name}: ${selected.name}. Choose a different file`
            : `Choose a replacement file for ${name}`
        }
        aria-describedby={`${hintId} ${errorId}`}
        aria-invalid={failure ? true : undefined}
        aria-disabled={busy || undefined}
        $isDragging={dragging}
        $hasFile={Boolean(selected)}
        $disabled={busy}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selected ? (
          <>
            <FileIcon aria-hidden="true">📄</FileIcon>
            <PickedName>{selected.name}</PickedName>
            <PickedSize>{formatBytes(selected.size)}</PickedSize>
          </>
        ) : (
          <>
            <UploadIcon aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                focusable="false"
              >
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </UploadIcon>
            <DropZoneText>Drag &amp; drop or <BrowseSpan>browse</BrowseSpan></DropZoneText>
          </>
        )}
      </DropZone>

      <Hint id={hintId}>
        Images, video, PDF or text · up to {limitMb} MB
      </Hint>

      <ErrorRegion id={errorId} role="alert">
        {failure && (
          <>
            {failure.message}
            {failure.upgrade && <> <UpgradeLink to="/pricing">Upgrade to Pro</UpgradeLink></>}
          </>
        )}
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

const Note = styled.p`
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e7;
  border: 1px solid #f0dfaa;
  color: #7a5c1f;
  font-size: 13px;
  line-height: 1.5;
`;

/* Same look as FileUploader's DropZone, deliberately duplicated: that component
   is a page-level upload flow and is not being refactored for this dialog. */
const DropZone = styled.div`
  min-height: 148px;
  box-sizing: border-box;
  border: 2px dashed ${({ $isDragging, $hasFile }) =>
    $isDragging || $hasFile ? '#4CAF50' : '#d0d0d0'};
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  padding: 24px 18px;
  background: ${({ $isDragging, $hasFile }) =>
    $isDragging ? '#f0faf0' : $hasFile ? '#f8fff8' : '#fafafa'};
  transition: border-color 0.2s, background 0.2s;
  ${focusRing}

  &:hover { border-color: #4CAF50; background: #f0faf0; }

  ${p => p.$disabled && css`
    cursor: not-allowed;
    opacity: 0.6;
    &:hover { border-color: #d0d0d0; background: #fafafa; }
  `}

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const UploadIcon = styled.div`
  color: #bbb;
  line-height: 0;
`;

const DropZoneText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #555;
`;

const BrowseSpan = styled.span`
  color: #4CAF50;
  font-weight: 500;
`;

const FileIcon = styled.div`
  font-size: 28px;
`;

const PickedName = styled.p`
  margin: 0;
  max-width: 100%;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-align: center;
  /* overflow-wrap: anywhere rather than word-break: break-all — only breaks a
     word that cannot fit, so normal filenames stay readable at 320px. */
  overflow-wrap: anywhere;
`;

const PickedSize = styled.p`
  margin: 0;
  font-size: 12px;
  color: #7e8f87;
`;

/* #7e8f87 rather than the old #aaa — same muted tone as the file card meta and
   readable against white. */
const Hint = styled.p`
  margin: 8px 0 0;
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

const UpgradeLink = styled(Link)`
  color: #1f7a55;
  font-weight: 600;
  text-decoration: underline;
  border-radius: 4px;
  ${focusRing}
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
