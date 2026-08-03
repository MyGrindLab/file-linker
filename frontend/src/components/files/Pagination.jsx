import styled, { css } from 'styled-components';

/**
 * Prev / "Page 2 of 5" / Next control for an offset-based list.
 *
 * Renders nothing at all when everything fits on one page (`total <= limit`),
 * so the caller can mount it unconditionally.
 *
 * @typedef {Object} PaginationProps
 * @property {number} offset   Offset of the page being shown.
 * @property {number} limit    Page size.
 * @property {number} total    Total rows across all pages.
 * @property {(offset: number) => void} onChange Called with the offset of the requested page.
 * @property {boolean} [busy=false] Disables both buttons while a fetch is in flight.
 * @property {string} [label='Pagination'] Accessible name for the <nav>.
 *
 * @param {PaginationProps} props
 */
export default function Pagination({
  offset = 0,
  limit = 20,
  total = 0,
  onChange,
  busy = false,
  label = 'Pagination',
}) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 20;
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.trunc(total) : 0;

  if (safeTotal <= safeLimit) return null;

  const pageCount = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : 0;
  const current = Math.min(pageCount, Math.floor(safeOffset / safeLimit) + 1);

  const isFirst = current <= 1;
  const isLast = current >= pageCount;

  const go = (pageNumber) => {
    if (typeof onChange !== 'function') return;
    onChange((pageNumber - 1) * safeLimit);
  };

  return (
    <Nav aria-label={label}>
      <GhostButton
        type="button"
        aria-label="Previous page"
        disabled={isFirst || busy}
        onClick={() => go(current - 1)}
      >
        <Arrow aria-hidden="true">←</Arrow> Previous
      </GhostButton>

      <Status aria-live="polite">
        Page {current} of {pageCount}
      </Status>

      <GhostButton
        type="button"
        aria-label="Next page"
        disabled={isLast || busy}
        onClick={() => go(current + 1)}
      >
        Next <Arrow aria-hidden="true">→</Arrow>
      </GhostButton>
    </Nav>
  );
}

const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }
`;

const Status = styled.p`
  margin: 0;
  font-size: 13px;
  color: #7e8f87;
`;

/* Separated from the list above it, so the control reads as page furniture
   rather than one more row. */
const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid rgba(24, 57, 42, 0.08);

  /* Narrow screens: buttons split one row, the status centres on its own line
     underneath instead of being stranded by space-between. */
  @media (max-width: 480px) {
    gap: 10px;

    > button { flex: 1 1 0; justify-content: center; padding: 10px 14px; }

    ${Status} {
      order: 1;
      flex: 1 1 100%;
      text-align: center;
    }
  }
`;

const GhostButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
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

  &:disabled {
    background: none;
    color: #aab5af;
    border-color: rgba(24, 57, 42, 0.1);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const Arrow = styled.span`
  font-size: 15px;
  line-height: 1;
`;
