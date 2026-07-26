import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { subscribeToToasts } from '../utils/toast';

const DURATION = 4000;

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsub = subscribeToToasts(toast => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, DURATION);
    });
    return unsub;
  }, []);

  if (!toasts.length) return null;

  return (
    <Container>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          $type={toast.type}
          onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        >
          {toast.message}
        </ToastItem>
      ))}
    </Container>
  );
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
  pointer-events: none;
`;

const ToastItem = styled.div`
  pointer-events: auto;
  max-width: 360px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
  animation: ${slideIn} 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  ${({ $type }) => $type === 'error' ? `
    background: #fff1f0;
    border: 1px solid #ffa39e;
    color: #b91c1c;
  ` : `
    background: #f0faf4;
    border: 1px solid #86efac;
    color: #15803d;
  `}
`;
