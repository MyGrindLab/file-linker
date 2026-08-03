// The automatic JSX runtime (@vitejs/plugin-react) is in use, so no default
// React import is needed here — `React.*` below appears only in JSDoc types.
import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';

/**
 * Generic accessible modal dialog.
 *
 * @typedef {Object} ModalProps
 * @property {boolean}   open              Renders the dialog when true.
 * @property {() => void} onClose          Called on Esc, backdrop click or the close button.
 *                                         Never called while `busy` is true.
 * @property {React.ReactNode} title       Accessible name — wired to `aria-labelledby`.
 * @property {React.ReactNode} [description] Optional supporting copy — wired to `aria-describedby`.
 * @property {boolean}  [busy=false]       Submission in flight: blocks Esc, backdrop click and
 *                                         the close button, and sets `aria-busy` on the panel.
 * @property {React.RefObject<HTMLElement>} [initialFocusRef]
 *                                         Element to focus on open (delete → Cancel, password →
 *                                         first field). Falls back to the first focusable node,
 *                                         then to the panel itself.
 * @property {React.ReactNode} [footer]    Actions slot, laid out in a right-aligned row.
 * @property {boolean}  [hideCloseButton=false] Hides the "×" button (footer still closes).
 * @property {string}   [closeLabel='Close dialog'] aria-label for the "×" button.
 * @property {React.ReactNode} [children]  Dialog body.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusable(el, checkGeometry) {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hidden || el.closest('[inert]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return checkGeometry ? el.getClientRects().length > 0 : true;
}

function getFocusable(root) {
  if (!root) return [];
  // jsdom has no layout engine, so every element reports zero client rects.
  // Only apply the geometric check when the panel itself reports a box —
  // otherwise the trap would see no focusable elements at all under test.
  const checkGeometry = root.getClientRects().length > 0;
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusable(el, checkGeometry)
  );
}

/*
 * Body scroll lock is refcounted at module scope so stacked modals (or a modal
 * opened from another modal) restore the *original* inline overflow exactly once
 * instead of clobbering each other's saved value.
 */
let scrollLockCount = 0;
let previousBodyOverflow = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) previousBodyOverflow = document.body.style.overflow;
  scrollLockCount += 1;
  document.body.style.overflow = 'hidden';

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
  };
}

/** @param {ModalProps} props */
export default function Modal({
  open,
  onClose,
  title,
  description,
  busy = false,
  initialFocusRef,
  footer,
  hideCloseButton = false,
  closeLabel = 'Close dialog',
  children,
}) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const pointerDownInsideRef = useRef(false);

  // Keep the latest values available to the document-level listener without
  // re-subscribing on every render.
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descriptionId = `modal-description-${reactId}`;

  const requestClose = useCallback(() => {
    if (busyRef.current) return;
    onCloseRef.current?.();
  }, []);

  // Focus management: move focus in on open, hand it back on close/unmount.
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    returnFocusRef.current =
      previouslyFocused instanceof HTMLElement ? previouslyFocused : null;

    const panel = panelRef.current;
    const target =
      (initialFocusRef && initialFocusRef.current) || getFocusable(panel)[0] || panel;
    target?.focus?.();

    return () => {
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
    };
    // initialFocusRef is a ref object; only `open` should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll lock, released on close and on unmount-while-open.
  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  // Esc to close + focus trap. Listener lives on document so the key works even
  // if focus lands on the panel itself.
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (busyRef.current) return;
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, requestClose]);

  if (!open || typeof document === 'undefined') return null;

  // Only treat a click as a backdrop click when the gesture both started and
  // ended on the overlay (a text-selection drag out of the panel must not close).
  const handleOverlayMouseDown = (event) => {
    pointerDownInsideRef.current = event.target !== event.currentTarget;
  };

  const handleOverlayClick = (event) => {
    const startedInside = pointerDownInsideRef.current;
    pointerDownInsideRef.current = false;
    if (startedInside || event.target !== event.currentTarget) return;
    requestClose();
  };

  return createPortal(
    <Overlay
      data-testid="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <Panel
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        data-testid="modal-panel"
      >
        <Header>
          <Title id={titleId}>{title}</Title>
          {!hideCloseButton && (
            <CloseButton
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label={closeLabel}
              data-testid="modal-close"
            >
              <span aria-hidden="true">×</span>
            </CloseButton>
          )}
        </Header>

        {description && <Description id={descriptionId}>{description}</Description>}

        {children && <Body>{children}</Body>}

        {footer && <Footer>{footer}</Footer>}
      </Panel>
    </Overlay>,
    document.body
  );
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Horizontal gutters come from the panel's own width formula, so the two
     don't stack and the panel keeps 16px gutters down to 320px. */
  padding: 24px 0;
  background: rgba(16, 27, 22, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.14s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;

const Panel = styled.div`
  position: relative;
  box-sizing: border-box;
  width: calc(100% - 32px);
  max-width: 440px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid rgba(24, 57, 42, 0.08);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 18px 48px rgba(16, 27, 22, 0.18);
  outline: none;
  animation: ${popIn} 0.14s ease-out;

  &:focus-visible {
    box-shadow: 0 18px 48px rgba(16, 27, 22, 0.18), 0 0 0 3px rgba(31, 122, 85, 0.28);
  }

  @media (max-width: 360px) {
    padding: 22px 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  color: #101b16;
  letter-spacing: -0.2px;
  overflow-wrap: anywhere;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -4px -6px 0 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 22px;
  line-height: 1;
  color: #6d7b74;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: #f2f5f3;
    color: #18392a;
  }

  /* Matches the shared focus ring used by every other control in these dialogs
     (footer buttons, inputs, pagination) — see FileCard / PasswordDialog. */
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }

  &:disabled {
    color: #c3ccc7;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4d6057;
`;

const Body = styled.div`
  margin-top: 18px;
  font-size: 14px;
  line-height: 1.6;
  color: #1b2e25;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 24px;

  @media (max-width: 360px) {
    justify-content: stretch;

    > * {
      flex: 1 1 100%;
    }
  }
`;
