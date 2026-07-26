import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../services/api';

const ANON_RATE_LIMIT_KEY = 'anon_last_upload';
const ANON_RATE_LIMIT_MS = 60 * 1000;

const MAX_SIZES = {
  anon: 10 * 1024 * 1024,
  free: 10 * 1024 * 1024,
  paid: 100 * 1024 * 1024,
};

function getAnonCooldownSeconds() {
  const last = localStorage.getItem(ANON_RATE_LIMIT_KEY);
  if (!last) return 0;
  const remaining = ANON_RATE_LIMIT_MS - (Date.now() - parseInt(last, 10));
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

const FileUploader = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedFile, setPastedFile] = useState(null);
  const [filePassword, setFilePassword] = useState('');
  const [pastePassword, setPastePassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fileMethodResult, setFileMethodResult] = useState(null);
  const [pasteMethodResult, setPasteMethodResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const maxSizeBytes = user?.is_paid ? MAX_SIZES.paid : MAX_SIZES.free;

  const maxLabel = user?.is_paid
    ? '100 MB max · permanent link'
    : user
    ? '10 MB max · 10-day link'
    : '10 MB max · 1-day link';

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setFileMethodResult(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setFileMethodResult(null);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const items = (e.clipboardData || window.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const file = new File([blob], 'pasted-image.png', { type: blob.type });
        setPastedFile(file);
        setPasteMethodResult(null);
        break;
      }
    }
  };

  const doUpload = async (file, isPasteMethod = false) => {
    if (!file) return;

    if (!user) {
      const wait = getAnonCooldownSeconds();
      if (wait > 0) {
        setError(`Please wait ${wait}s before uploading again.`);
        return;
      }
    }

    if (file.size > maxSizeBytes) {
      const limitMB = maxSizeBytes / 1024 / 1024;
      setError(`File exceeds the ${limitMB} MB limit for your plan.`);
      return;
    }

    const password = isPasteMethod ? pastePassword.trim() : filePassword.trim();
    if (password && password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const response = await uploadFile(file, password);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.detail || 'Upload failed');
      }
      const result = await response.json();
      if (!user) localStorage.setItem(ANON_RATE_LIMIT_KEY, String(Date.now()));
      if (isPasteMethod) {
        setPasteMethodResult({ link: result.value });
        setPastedFile(null);
        setPastePassword('');
      } else {
        setFileMethodResult({ link: result.value });
        setSelectedFile(null);
        setFilePassword('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Container>
      <TierHint>
        {maxLabel}
        {!user && <> · <AuthLink to="/login">Login for larger limits</AuthLink></>}
      </TierHint>

      <UploadSection>
        <MethodContainer>
          <h3>Method 1: Select File</h3>
          <DropZone
            $isDragging={isDragging}
            $hasFile={!!selectedFile}
            onClick={() => !isUploading && fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
            {selectedFile ? (
              <>
                <FileIcon>📄</FileIcon>
                <FileName>{selectedFile.name}</FileName>
                <FileSize>{(selectedFile.size / 1024).toFixed(1)} KB</FileSize>
              </>
            ) : (
              <>
                <UploadIcon>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                </UploadIcon>
                <DropZoneText>Drag & drop or <BrowseSpan>browse</BrowseSpan></DropZoneText>
                <DropZoneHint>Any file type supported</DropZoneHint>
              </>
            )}
          </DropZone>
          {user && (
            <PasswordInput
              type="password"
              value={filePassword}
              onChange={(e) => setFilePassword(e.target.value)}
              placeholder="Optional link password"
              minLength="4"
              maxLength="128"
              disabled={isUploading}
            />
          )}
          <Button
            onClick={() => doUpload(selectedFile, false)}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </Button>
          {fileMethodResult && (
            <ResultContainer>
              <strong>Link:</strong>
              <ResultLink href={fileMethodResult.link} target="_blank" rel="noopener noreferrer">
                {fileMethodResult.link}
              </ResultLink>
            </ResultContainer>
          )}
        </MethodContainer>

        <MethodContainer>
          <h3>Method 2: Paste Image</h3>
          <PasteArea
            onPaste={handlePaste}
            tabIndex="0"
            $hasFile={!!pastedFile}
          >
            {pastedFile ? (
              <PastedImage src={URL.createObjectURL(pastedFile)} alt="Pasted content" />
            ) : (
              <PasteHint>Click here and paste (Ctrl+V)</PasteHint>
            )}
          </PasteArea>
          {user && (
            <PasswordInput
              type="password"
              value={pastePassword}
              onChange={(e) => setPastePassword(e.target.value)}
              placeholder="Optional link password"
              minLength="4"
              maxLength="128"
              disabled={isUploading}
            />
          )}
          <Button
            onClick={() => doUpload(pastedFile, true)}
            disabled={!pastedFile || isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </Button>
          {pasteMethodResult && (
            <ResultContainer>
              <strong>Link:</strong>
              <ResultLink href={pasteMethodResult.link} target="_blank" rel="noopener noreferrer">
                {pasteMethodResult.link}
              </ResultLink>
            </ResultContainer>
          )}
        </MethodContainer>
      </UploadSection>

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Container>
  );
};

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const TierHint = styled.p`
  font-size: 13px;
  color: #888;
  margin: 0 0 20px;
`;

const AuthLink = styled(Link)`
  color: #4CAF50;
  text-decoration: none;
  font-weight: 500;
  &:hover { text-decoration: underline; }
`;

const UploadSection = styled.div`
  display: flex;
  gap: 30px;
  margin-bottom: 30px;
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
  }
`;

const MethodContainer = styled.div`
  flex: 1;
  padding: 28px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  h3 { margin-top: 0; color: #333; font-size: 16px; font-weight: 600; }
`;

const DropZone = styled.div`
  min-height: 240px;
  border: 2px dashed ${({ $isDragging, $hasFile }) =>
    $isDragging ? '#4CAF50' : $hasFile ? '#4CAF50' : '#d0d0d0'};
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  padding: 32px;
  margin: 16px 0;
  background: ${({ $isDragging, $hasFile }) =>
    $isDragging ? '#f0faf0' : $hasFile ? '#f8fff8' : '#fafafa'};
  transition: all 0.2s;
  &:hover { border-color: #4CAF50; background: #f0faf0; }
`;

const UploadIcon = styled.div`
  color: #bbb;
  margin-bottom: 4px;
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

const DropZoneHint = styled.p`
  margin: 0;
  font-size: 12px;
  color: #aaa;
`;

const FileIcon = styled.div`
  font-size: 28px;
`;

const FileName = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-align: center;
  word-break: break-all;
`;

const FileSize = styled.p`
  margin: 0;
  font-size: 12px;
  color: #888;
`;

const Button = styled.button`
  width: 100%;
  padding: 12px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: background-color 0.2s;
  &:hover:not(:disabled) { background-color: #43a047; }
  &:disabled { background-color: #ccc; cursor: not-allowed; }
`;

const PasswordInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  margin: 0 0 12px;
  border: 1px solid #d8d8d8;
  border-radius: 8px;
  color: #222;
  background: #fff;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76,175,80,0.18);
  }
  &:disabled {
    color: #888;
    background: #f5f5f5;
  }
`;

const PasteArea = styled.div`
  min-height: 240px;
  border: 2px dashed ${props => props.$hasFile ? '#4CAF50' : '#d0d0d0'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 32px;
  margin: 16px 0;
  background-color: ${props => props.$hasFile ? '#f8fff8' : '#fafafa'};
  border-radius: 10px;
  transition: all 0.2s;
  &:hover { border-color: #999; }
  &:focus { outline: none; border-color: #4CAF50; box-shadow: 0 0 0 2px rgba(76,175,80,0.2); }
`;

const PastedImage = styled.img`
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
`;

const PasteHint = styled.p`
  margin: 0;
  color: #aaa;
  text-align: center;
  font-size: 14px;
`;

const ResultContainer = styled.div`
  margin-top: 14px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 6px;
  word-break: break-all;
  font-size: 13px;
`;

const ResultLink = styled.a`
  display: block;
  margin-top: 4px;
  color: #2196F3;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const ErrorMessage = styled.div`
  color: #d32f2f;
  background-color: #fde7e7;
  padding: 12px 16px;
  border-radius: 6px;
  margin-top: 10px;
  font-size: 14px;
`;

export default FileUploader;
