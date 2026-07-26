import React, { useEffect, useRef, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const API = import.meta.env.VITE_API_BASE_URL;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function parseOriginalFilename(disposition) {
  if (!disposition) return null;
  const rfc5987 = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (rfc5987) return decodeURIComponent(rfc5987[1].trim());
  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1].trim() : null;
}

const VIDEO_MIMES = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/mp4' };

function videoMime(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return VIDEO_MIMES[ext] || 'video/mp4';
}

function getFileType(filename) {
  if (!filename) return 'unsupported';
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (['html', 'txt', 'log', 'csv', 'json', 'xml'].includes(ext)) return 'text';
  return 'unsupported';
}


function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const updateMatches = () => setMatches(media.matches);

    updateMatches();
    media.addEventListener('change', updateMatches);
    return () => media.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}

function PdfPreview({ fileUrl }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = containerWidth ? Math.min(containerWidth, 920) : undefined;

  return (
    <PdfScroll ref={containerRef}>
      <Document
        file={fileUrl}
        loading={<StatusText>Loading PDF...</StatusText>}
        error={<StatusText>Failed to render PDF</StatusText>}
        onLoadSuccess={({ numPages: nextNumPages }) => setNumPages(nextNumPages)}
      >
        {pageWidth && numPages
          ? Array.from({ length: numPages }, (_, index) => (
            <PdfPageFrame key={`page_${index + 1}`}>
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                renderAnnotationLayer
                renderTextLayer
              />
            </PdfPageFrame>
          ))
          : null}
      </Document>
    </PdfScroll>
  );
}

export default function FileViewer({ filename }) {
  const [originalName, setOriginalName] = useState(filename);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);

  const fileUrl = `${API}/file/${filename}/`;

  const fetchFile = async (filePassword = '') => {
    const headers = filePassword ? { 'X-File-Password': filePassword } : {};
    const res = await fetch(fileUrl, { headers });
    const name = parseOriginalFilename(res.headers.get('content-disposition'));
    if (name) setOriginalName(name);

    if (res.status === 423) {
      setLocked(true);
      setError(null);
      return null;
    }

    if (res.status === 403) {
      setLocked(true);
      setError('Invalid password');
      return null;
    }

    if (!res.ok) {
      setError('File not found');
      return null;
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const displayName = name || originalName || filename;
    const ext = (displayName || '').split('.').pop().toLowerCase();

    setFileBlobUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return blobUrl;
    });
    setLocked(false);
    setError(null);

    if (['html', 'txt', 'log', 'csv', 'json', 'xml'].includes(ext)) {
      setTextContent(await blob.text());
    } else {
      setTextContent(null);
    }

    return blobUrl;
  };

  useEffect(() => {
    if (!filename) return;
    setLoading(true);
    setOriginalName(filename);
    setPassword('');
    setTextContent(null);
    setFileBlobUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    fetchFile()
      .catch(() => setError('Failed to load file'))
      .finally(() => setLoading(false));
  }, [filename]);

  useEffect(() => {
    return () => {
      if (fileBlobUrl) URL.revokeObjectURL(fileBlobUrl);
    };
  }, [fileBlobUrl]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Enter the password');
      return;
    }

    setSubmittingPassword(true);
    setError(null);
    try {
      await fetchFile(password);
    } catch {
      setError('Failed to load file');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const type = getFileType(originalName || filename);
  const useMobilePdfPreview = useMediaQuery('(max-width: 768px)');
  const isMobilePdf = type === 'pdf' && useMobilePdfPreview;

  if (loading) return <Overlay><StatusText>Loading…</StatusText></Overlay>;
  if (locked) {
    return (
      <Overlay>
        <PasswordBox onSubmit={handlePasswordSubmit}>
          <PasswordTitle>Enter password</PasswordTitle>
          <PasswordField
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <PasswordError>{error}</PasswordError>}
          <PasswordButton disabled={submittingPassword}>
            {submittingPassword ? 'Opening…' : 'Open file'}
          </PasswordButton>
        </PasswordBox>
      </Overlay>
    );
  }
  if (error) return <Overlay><StatusText>{error}</StatusText></Overlay>;

  return (
    <>
      <GlobalTheme />
      <Shell $documentMode={isMobilePdf}>
        <Preview $scrollable={isMobilePdf || type === 'text'} $documentMode={isMobilePdf}>
          {type === 'image' && (
            <img src={fileBlobUrl} alt={originalName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
          {type === 'video' && (
            <video controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }}>
              <source src={fileBlobUrl} type={videoMime(originalName)} />
            </video>
          )}
          {type === 'pdf' && (
            isMobilePdf ? (
              <PdfPreview fileUrl={fileBlobUrl} />
            ) : (
              <iframe
                src={fileBlobUrl}
                title={originalName}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            )
          )}
          {type === 'text' && (
            <TextPreview>{textContent}</TextPreview>
          )}
          {type === 'unsupported' && (
            <UnsupportedBox>
              <p>Preview not available for this file type.</p>
              <DownloadLink href={fileBlobUrl} download={originalName}>Download file</DownloadLink>
            </UnsupportedBox>
          )}
        </Preview>

        <Bar>
          <FileName title={originalName}>{originalName}</FileName>
          <DownloadLink href={fileBlobUrl} download={originalName}>Download</DownloadLink>
        </Bar>
      </Shell>
    </>
  );
}

const GlobalTheme = createGlobalStyle`
  :root { color-scheme: light dark; }

  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;

    @media (prefers-color-scheme: dark) {
      background: #111;
      color: #e8e8e8;
    }
  }
`;

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  height: ${({ $documentMode }) => ($documentMode ? 'auto' : '100vh')};
  height: ${({ $documentMode }) => ($documentMode ? 'auto' : '100dvh')};
  width: 100vw;
  overflow: ${({ $documentMode }) => ($documentMode ? 'visible' : 'hidden')};
`;

const Preview = styled.div`
  flex: ${({ $documentMode }) => ($documentMode ? '0 0 auto' : '1')};
  display: flex;
  align-items: ${({ $scrollable }) => ($scrollable ? 'stretch' : 'center')};
  justify-content: ${({ $scrollable }) => ($scrollable ? 'flex-start' : 'center')};
  overflow: ${({ $documentMode, $scrollable }) => ($documentMode ? 'visible' : ($scrollable ? 'auto' : 'hidden'))};
  padding: 20px;
  box-sizing: border-box;
  background: #fff;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  @media (prefers-color-scheme: dark) { background: #111; }

  @media (max-width: 640px) {
    padding: ${({ $scrollable }) => ($scrollable ? '10px' : '16px')};
  }
`;

const PdfScroll = styled.div`
  width: 100%;
  min-height: 100%;
  display: flex;
  justify-content: center;

  .react-pdf__Document {
    width: min(100%, 920px);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .react-pdf__Page {
    width: 100%;
    background: #fff;
  }

  .react-pdf__Page canvas {
    width: 100% !important;
    height: auto !important;
    display: block;
  }
`;

const PdfPageFrame = styled.div`
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.14);

  @media (prefers-color-scheme: dark) {
    box-shadow: 0 1px 10px rgba(0, 0, 0, 0.45);
  }
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  flex-shrink: 0;
  border-top: 1px solid #e8e8e8;
  background: #fff;
  @media (prefers-color-scheme: dark) {
    background: #1a1a1a;
    border-top-color: #2a2a2a;
  }
`;

const FileName = styled.span`
  font-size: 13px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 120px);
  @media (prefers-color-scheme: dark) { color: #666; }
`;

const DownloadLink = styled.a`
  font-size: 13px;
  font-weight: 500;
  color: #4CAF50;
  text-decoration: none;
  flex-shrink: 0;
  &:hover { text-decoration: underline; }
`;

const Overlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #fff;
  @media (prefers-color-scheme: dark) { background: #111; }
`;

const StatusText = styled.p`
  font-size: 15px;
  color: #888;
`;

const PasswordBox = styled.form`
  width: min(360px, calc(100vw - 40px));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PasswordTitle = styled.h1`
  margin: 0;
  color: #222;
  font-size: 18px;
  font-weight: 600;
  @media (prefers-color-scheme: dark) { color: #f0f0f0; }
`;

const PasswordField = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #d8d8d8;
  border-radius: 8px;
  color: #222;
  background: #fff;
  font-size: 15px;
  &:focus {
    outline: none;
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76,175,80,0.18);
  }
  @media (prefers-color-scheme: dark) {
    color: #f0f0f0;
    background: #1c1c1c;
    border-color: #333;
  }
`;

const PasswordError = styled.p`
  margin: 0;
  color: #d32f2f;
  font-size: 13px;
`;

const PasswordButton = styled.button`
  padding: 12px 16px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #4CAF50;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  &:disabled {
    background: #aaa;
    cursor: not-allowed;
  }
`;

const TextPreview = styled.pre`
  margin: 0;
  padding: 20px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: #111;
  @media (prefers-color-scheme: dark) { color: #e8e8e8; }
`;

const UnsupportedBox = styled.div`
  text-align: center;
  color: #888;
  p { margin: 0 0 16px; font-size: 15px; }
`;
