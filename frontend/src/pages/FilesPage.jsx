import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';
import DeleteFileDialog from '../components/files/DeleteFileDialog';
import FileCard from '../components/files/FileCard';
import Pagination from '../components/files/Pagination';
import PasswordDialog from '../components/files/PasswordDialog';
import ReplaceFileDialog from '../components/files/ReplaceFileDialog';
import { useAuth } from '../context/AuthContext';
import useMyFiles, { PAGE_SIZE } from '../hooks/useMyFiles';

const SKELETON_ROWS = [0, 1, 2];

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // The whole hook result is kept: the page reads the list state, and the
  // dialogs call patchItem / removeItem / reloadAfterDelete after a successful
  // mutation.
  const files = useMyFiles(PAGE_SIZE, { enabled: Boolean(user) });
  const {
    items, total, offset, limit, status, error,
    reload, reloadAfterDelete, goTo, patchItem, removeItem,
  } = files;

  // Which action dialog is open, and for which file. The modals render from
  // this state; the page only owns opening/closing and focus restore.
  const [dialog, setDialog] = useState(/** @type {{kind: string, file: object}|null} */(null));
  const triggerRef = useRef(/** @type {HTMLElement|null} */(null));
  const dialogWasOpenRef = useRef(false);

  useEffect(() => {
    if (!user) { navigate('/login'); }
  }, [user, navigate]);

  const openDialog = useCallback((kind, file) => {
    // Remember the control that opened the dialog so focus can come back to it.
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;
    setDialog({ kind, file });
  }, []);

  // Return focus to the trigger when the dialog closes. Modal does this too, but
  // the row may have been removed (delete) — then focus falls back to the body
  // rather than a detached node.
  useEffect(() => {
    if (dialog) { dialogWasOpenRef.current = true; return; }
    if (!dialogWasOpenRef.current) return;
    dialogWasOpenRef.current = false;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }, [dialog]);

  const handleReplace = useCallback((file) => openDialog('replace', file), [openDialog]);
  const handlePassword = useCallback((file) => openDialog('password', file), [openDialog]);
  const handleDelete = useCallback((file) => openDialog('delete', file), [openDialog]);

  const closeDialog = useCallback(() => setDialog(null), []);

  // A dialog hit a 404: the file is gone server-side. Drop the stale row for an
  // immediate update, then refetch so the page refills from the real offset.
  const handleMissing = useCallback((shortId) => {
    removeItem(shortId);
    reload();
  }, [removeItem, reload]);

  // Replace returns the updated FileInfo; patch it in place so the row keeps its
  // position. A body we could not parse falls back to a refetch.
  const handleReplaced = useCallback((shortId, fields) => {
    if (fields) patchItem(shortId, fields);
    else reload();
  }, [patchItem, reload]);

  if (!user) return null;

  return (
    <>
      <Seo
        title="My files"
        description="Manage the files you have uploaded to FileLinker."
        path="/files"
        noindex
      />
      <Navbar />
      <Page>
        <PageHeader>
          <Heading>My files</Heading>
          {status === 'ready' && (
            <Muted>{total === 1 ? '1 file' : `${total} files`}</Muted>
          )}
        </PageHeader>

        {status === 'loading' && (
          <SkeletonList aria-busy="true">
            <VisuallyHidden>Loading your files</VisuallyHidden>
            {/* Mirrors the FileCard grid (glyph · text · link row) so the real
                list drops in without a jump. Purely decorative: aria-hidden. */}
            {SKELETON_ROWS.map((row) => (
              <SkeletonCard key={row} aria-hidden="true" $row={row}>
                <SkeletonGlyph />
                <SkeletonBody>
                  <SkeletonLine $width="55%" />
                  <SkeletonLine $width="30%" $short />
                  <SkeletonPills>
                    <SkeletonPill />
                    <SkeletonPill $wide />
                  </SkeletonPills>
                </SkeletonBody>
                <SkeletonActions>
                  <SkeletonButton $width="76px" />
                  <SkeletonButton $width="86px" />
                  <SkeletonButton $width="70px" />
                </SkeletonActions>
                <SkeletonLink />
              </SkeletonCard>
            ))}
          </SkeletonList>
        )}

        {status === 'error' && (
          <Card role="alert">
            <CardTitle>Could not load your files</CardTitle>
            <Muted>{error}</Muted>
            <GhostButton type="button" onClick={reload}>Try again</GhostButton>
          </Card>
        )}

        {status === 'ready' && total === 0 && (
          <Card>
            <CardTitle>No files yet</CardTitle>
            <Muted>You haven&apos;t uploaded any files yet.</Muted>
            <UploadLink to="/">Upload a file</UploadLink>
          </Card>
        )}

        {status === 'ready' && total > 0 && (
          <List aria-label="Your files">
            {items.map((file) => (
              <FileCard
                key={file.short_id}
                file={file}
                onReplace={handleReplace}
                onPassword={handlePassword}
                onDelete={handleDelete}
              />
            ))}
          </List>
        )}

        {status !== 'error' && (
          <Pagination
            offset={offset}
            limit={limit}
            total={total}
            onChange={goTo}
            busy={status === 'loading'}
            label="Files pagination"
          />
        )}

        {/*
          Dialogs are *mounted* only while open (rather than kept mounted with an
          `open` prop) so each one starts from clean state: no file left selected
          and no password left in a field from the previous row.
        */}
        {dialog?.kind === 'replace' && (
          <ReplaceFileDialog
            key={dialog.file.short_id}
            file={dialog.file}
            onClose={closeDialog}
            onReplaced={handleReplaced}
            onMissing={handleMissing}
          />
        )}

        {dialog?.kind === 'password' && (
          <PasswordDialog
            key={dialog.file.short_id}
            file={dialog.file}
            onClose={closeDialog}
            onUpdated={patchItem}
            onMissing={handleMissing}
          />
        )}

        {dialog?.kind === 'delete' && (
          <DeleteFileDialog
            key={dialog.file.short_id}
            file={dialog.file}
            onClose={closeDialog}
            onDeleted={reloadAfterDelete}
            onMissing={handleMissing}
          />
        )}
      </Page>
    </>
  );
}

/* Shared focus treatment for every interactive element on this page. Kept local
   (rather than in styles.css) so the page owns its own presentation. */
const focusRing = css`
  &:focus-visible {
    outline: 2px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
  }
`;

const Page = styled.div`
  max-width: 780px;
  margin: 48px auto;
  padding: 0 20px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  /* Match the modal's 16px gutters on small phones so the cards get the same
     breathing room as the dialogs they open. */
  @media (max-width: 400px) {
    margin: 32px auto;
    padding: 0 16px 48px;
  }
`;

/* Title and count share a baseline on wide screens and stack on narrow ones. */
const PageHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
`;

const Heading = styled.h1`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #101b16;
`;

const Muted = styled.p`
  margin: 0;
  font-size: 14px;
  color: #7e8f87;
`;

/* Empty and error states: centred so a single short sentence reads as a
   deliberate state rather than a stray paragraph in a wide card. */
const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(24, 57, 42, 0.1);
  border-radius: 16px;
  padding: 40px 28px;

  @media (max-width: 400px) {
    padding: 32px 20px;
  }
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #101b16;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

/* The rows animate themselves (see FileCard); the list only staggers them so a
   page of results settles in sequence instead of all at once. */
const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  > li:nth-child(2) { animation-delay: 40ms; }
  > li:nth-child(3) { animation-delay: 80ms; }
  > li:nth-child(n + 4) { animation-delay: 120ms; }

  @media (prefers-reduced-motion: reduce) {
    > li { animation-delay: 0s; }
  }
`;

const GhostButton = styled.button`
  padding: 10px 20px;
  background: none;
  color: #496052;
  border: 1px solid rgba(24, 57, 42, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  ${focusRing}

  &:hover {
    background: #f5f5f5;
    border-color: rgba(24, 57, 42, 0.3);
  }

  &:active { background: #ececec; }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const UploadLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  line-height: 1.3;
  color: #fff;
  background: linear-gradient(135deg, #1f7a55 0%, #2b9a67 100%);
  padding: 9px 18px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 500;
  transition: filter 0.15s, box-shadow 0.15s;
  ${focusRing}

  &:hover {
    filter: brightness(1.04);
    box-shadow: 0 4px 14px rgba(31, 122, 85, 0.24);
  }

  &:active { filter: brightness(0.96); }

  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

const SkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const shimmer = keyframes`
  from { background-position: 100% 50%; }
  to   { background-position: 0 50%; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* Same grid, padding and radius as FileCard so the real rows replace these
   without the list jumping. */
const SkeletonCard = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(24, 57, 42, 0.1);
  border-radius: 16px;
  padding: 18px 20px;

  @media (max-width: 400px) {
    padding: 16px;
    gap: 10px;
  }

  /* Rows settle in sequence, the same 160ms/40ms rhythm the real list uses. */
  animation: ${fadeUp} 160ms ease-out both;
  animation-delay: ${p => p.$row * 40}ms;

  @media (min-width: 760px) {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    animation-delay: 0s;
  }
`;

/* Gradient sweep rather than an opacity pulse: it reads as "loading" instead of
   "broken", and the wide background-size keeps the highlight soft. */
const shimmerSurface = css`
  background-color: #eef2ef;
  background-image: linear-gradient(
    90deg,
    rgba(238, 242, 239, 0) 20%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(238, 242, 239, 0) 80%
  );
  background-size: 300% 100%;
  background-repeat: no-repeat;
  animation: ${shimmer} 1.5s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const SkeletonGlyph = styled.span`
  ${shimmerSurface}
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 12px;
`;

const SkeletonBody = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SkeletonLine = styled.span`
  ${shimmerSurface}
  display: block;
  width: ${p => p.$width || '60%'};
  height: ${p => (p.$short ? '10px' : '14px')};
  border-radius: 999px;
`;

const SkeletonPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
`;

const SkeletonPill = styled.span`
  ${shimmerSurface}
  display: block;
  width: ${p => (p.$wide ? '86px' : '64px')};
  height: 18px;
  border-radius: 999px;
`;

const SkeletonActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;

  > * { flex: 1 1 auto; }

  @media (min-width: 760px) {
    > * { flex: 0 0 auto; }
  }
`;

const SkeletonButton = styled.span`
  ${shimmerSurface}
  display: block;
  width: ${p => p.$width || '76px'};
  height: 31px;
  border-radius: 8px;
`;

const SkeletonLink = styled.span`
  ${shimmerSurface}
  display: block;
  height: 44px;
  border-radius: 10px;

  @media (min-width: 760px) {
    grid-column: 1 / -1;
  }
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
