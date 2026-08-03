import { useCallback, useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { expiryLabel, fileExtension, formatBytes, formatDate } from '../../utils/format';
import { emitToast } from '../../utils/toast';

/** How long the copy button stays in its "Copied" state. */
const COPIED_MS = 1500;

const COPY_FAILED = 'Could not copy the link. Select it and copy manually.';

/**
 * Clipboard write for insecure contexts (plain http on a LAN IP, older
 * browsers): `navigator.clipboard` is undefined there, so fall back to a
 * throwaway off-screen textarea + `document.execCommand('copy')`.
 *
 * Any selection the user had is restored afterwards.
 *
 * @param {string} text
 * @returns {boolean} whether the copy actually happened
 */
function copyWithExecCommand(text) {
  if (typeof document.execCommand !== 'function') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Fixed + off-screen: no scroll jump, no layout shift, no zoom on iOS.
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  let copied = false;
  try {
    textarea.select();
    copied = document.execCommand('copy');
  } catch (err) {
    copied = false;
  }

  document.body.removeChild(textarea);
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return copied;
}

/**
 * Which expiry pill (if any) a file gets. Derived from `expiryLabel`, so the
 * wording and the styling can never disagree.
 *
 * @param {string} label
 * @returns {'grey'|'red'|'amber'|null}
 */
function expiryVariant(label) {
  if (label === 'Permanent') return 'grey';
  if (label === 'Expired') return 'red';
  return label ? 'amber' : null;
}

/**
 * One file in the "My files" list — renders the `<li>` itself, so the caller
 * drops it straight into its `<ul>`.
 *
 * Shows the file's identity (type glyph, name, size, upload date), its state as
 * pills (protected / permanent / expiring / expired / inactive), its public
 * link with copy + open, and the three row actions. The actions only report
 * intent: opening the dialog and mutating the list is the page's job.
 *
 * An inactive file (`is_active === false`) is dimmed and every button on the
 * card is disabled. This is purely defensive — the backend keeps inactive files
 * out of this list — so there is deliberately no filter UI for it.
 *
 * @typedef {import('../../services/api').FileInfo} FileInfo
 *
 * @typedef {Object} FileCardProps
 * @property {FileInfo} file
 * @property {(file: FileInfo) => void} [onReplace]  "Replace" pressed.
 * @property {(file: FileInfo) => void} [onPassword] "Password" pressed.
 * @property {(file: FileInfo) => void} [onDelete]   "Delete" pressed.
 *
 * @param {FileCardProps} props
 */
export default function FileCard({ file, onReplace, onPassword, onDelete }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */(null));
  const aliveRef = useRef(true);

  useEffect(() => () => {
    aliveRef.current = false;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const link = file.link || '';

  const handleCopy = useCallback(async () => {
    if (!link) return;

    let ok = false;
    // navigator.clipboard only exists in a secure context (https / localhost).
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        ok = true;
      } catch (err) {
        ok = false;
      }
    }
    if (!ok) ok = copyWithExecCommand(link);
    if (!aliveRef.current) return;

    if (!ok) {
      emitToast(COPY_FAILED);
      return;
    }

    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      if (aliveRef.current) setCopied(false);
    }, COPIED_MS);
  }, [link]);

  const name = file.original_filename || 'Untitled file';
  const extension = fileExtension(file.original_filename);
  const uploaded = formatDate(file.uploaded_at);
  const expiry = expiryLabel(file.expires_at);
  const expiryTone = expiryVariant(expiry);
  const disabled = file.is_active === false;

  const act = (handler) => () => {
    if (typeof handler === 'function') handler(file);
  };

  return (
    <Card $dimmed={disabled}>
      <Glyph aria-hidden="true">{extension || 'FILE'}</Glyph>

      <Details>
        <Name title={name}>{name}</Name>
        <Meta>
          {formatBytes(file.size_bytes)}
          {uploaded && ` · Uploaded ${uploaded}`}
        </Meta>
        <Pills>
          {file.has_password && (
            <Pill $tone="green">
              <LockIcon />
              Protected
            </Pill>
          )}
          {expiryTone && <Pill $tone={expiryTone}>{expiry}</Pill>}
          {disabled && <Pill $tone="grey">Inactive</Pill>}
        </Pills>
      </Details>

      <Actions>
        <GhostButton
          type="button"
          onClick={act(onReplace)}
          disabled={disabled}
          aria-label={`Replace contents of ${name}`}
        >
          Replace
        </GhostButton>
        <GhostButton
          type="button"
          onClick={act(onPassword)}
          disabled={disabled}
          aria-label={`Manage password for ${name}`}
        >
          Password
        </GhostButton>
        <DangerGhostButton
          type="button"
          onClick={act(onDelete)}
          disabled={disabled}
          aria-label={`Delete ${name}`}
        >
          Delete
        </DangerGhostButton>
      </Actions>

      <LinkRow>
        <LinkText title={link}>{link}</LinkText>
        <GhostButton
          type="button"
          onClick={handleCopy}
          disabled={disabled || !link}
          /* While copied, the visible "Copied" is the accessible name — the
             state change is what matters more than the target at that moment. */
          aria-label={copied ? undefined : `Copy link to ${name}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </GhostButton>
        <OpenLink
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} in a new tab`}
        >
          Open
        </OpenLink>
      </LinkRow>

      <VisuallyHidden aria-live="polite">
        {copied ? `Link to ${name} copied to clipboard` : ''}
      </VisuallyHidden>
    </Card>
  );
}

/** Lock glyph, same stroke style as the upload icon in FileUploader. */
function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }
`;

const Details = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;

  /* Full-width row on narrow screens: share the space, wrap when it runs out
     rather than pushing the card wider than the viewport. */
  > * { flex: 1 1 auto; }
`;

const LinkText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #2196F3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* Tinted strip: the link is data, not prose, so it gets its own surface and the
   copy/open controls sit inside it instead of floating next to the card edge. */
const LinkRow = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(24, 57, 42, 0.08);
  border-radius: 10px;
  background: #f8faf9;

  /* Controls keep a white fill so they stay readable on the tinted strip. */
  > button:not(:disabled),
  > a { background: #fff; }

  /* Below ~420px an ellipsised URL sharing a line with two buttons leaves it
     unreadable, so the link takes its own row and the buttons split the next. */
  @media (max-width: 420px) {
    flex-wrap: wrap;
    padding: 8px;

    ${LinkText} {
      flex: 1 1 100%;
      padding: 0 2px 2px;
    }

    > button, > a { flex: 1 1 auto; }
  }
`;

const cardIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Card = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(24, 57, 42, 0.1);
  border-radius: 16px;
  padding: 18px 20px;
  transition: border-color 0.15s, box-shadow 0.15s;
  /* Runs once per mounted row; the list staggers it with animation-delay. */
  animation: ${cardIn} 160ms ease-out both;
  ${p => p.$dimmed && css`opacity: 0.6;`}

  &:hover {
    border-color: rgba(31, 122, 85, 0.35);
    box-shadow: 0 4px 16px rgba(24, 57, 42, 0.06);
  }

  /* Keyboard focus anywhere in the row lifts the whole card, so the active row
     is obvious even when the focused control is a small ghost button. */
  &:focus-within {
    border-color: rgba(31, 122, 85, 0.35);
  }

  /* Tighter gutters on small phones, matching the page padding, so the action
     buttons and the link keep as much width as possible. */
  @media (max-width: 400px) {
    padding: 16px;
    gap: 10px;
  }

  @media (min-width: 760px) {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 14px;
    row-gap: 12px;

    ${Actions} > * { flex: 0 0 auto; }
    ${LinkRow} { grid-column: 1 / -1; }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    animation: none;
  }
`;

const Glyph = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #edf7f1;
  border: 1px solid #caead8;
  font-size: 11px;
  font-weight: 700;
  color: #1f7a55;
  letter-spacing: 0.04em;
  overflow: hidden;
`;

// h2: the page's only other headings are the h1 and the empty/error cards, so
// this keeps the outline flat (h1 -> h2) with no skipped level.
const Name = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #101b16;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.p`
  margin: 0;
  font-size: 13px;
  color: #7e8f87;
`;

const Pills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
  &:empty { display: none; }
`;

const PILL_TONES = {
  green: css`
    color: #1f7a55;
    background: #edf7f1;
    border-color: #caead8;
  `,
  grey: css`
    color: #888;
    background: #f5f5f5;
    border-color: #e0e0e0;
  `,
  amber: css`
    color: #7a5c1f;
    background: #fff8e7;
    border-color: #f0dfaa;
  `,
  red: css`
    color: #d32f2f;
    background: #fde7e7;
    border-color: rgba(211, 47, 47, 0.25);
  `,
};

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  ${p => PILL_TONES[p.$tone] || PILL_TONES.grey}
`;

const smallButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  background: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  ${focusRing}

  &:disabled {
    cursor: not-allowed;
    color: #aab5af;
    border-color: rgba(24, 57, 42, 0.1);
    background: none;
  }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const GhostButton = styled.button`
  ${smallButton}
  color: #496052;
  border: 1px solid rgba(24, 57, 42, 0.2);

  &:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: rgba(24, 57, 42, 0.3);
  }

  &:active:not(:disabled) { background: #ececec; }
`;

const DangerGhostButton = styled.button`
  ${smallButton}
  color: #d32f2f;
  border: 1px solid rgba(211, 47, 47, 0.25);

  &:hover:not(:disabled) {
    background: #fde7e7;
    border-color: rgba(211, 47, 47, 0.4);
  }

  &:active:not(:disabled) { background: #fbd5d5; }
`;

const OpenLink = styled.a`
  ${smallButton}
  flex: 0 0 auto;
  color: #496052;
  border: 1px solid rgba(24, 57, 42, 0.2);
  text-decoration: none;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(24, 57, 42, 0.3);
  }

  &:active { background: #ececec; }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
`;
