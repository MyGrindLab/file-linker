import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { registerUser, verifyEmail, googleOAuthUrl, githubOAuthUrl } from '../services/api';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('register'); // 'register' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await registerUser(email, password);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed');
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyEmail(email, code);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Verification failed');
      login(data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Seo
        title="Create Account"
        description="Create a FileLinker account to get larger file limits, longer retention, and a faster file sharing workflow."
        path="/register"
        noindex
      />
      <Card>
        {step === 'register' ? (
          <>
            <Title>Create account</Title>
            <OAuthRow>
              <OAuthBtn href={googleOAuthUrl()}>
                <GoogleIcon />
                Google
              </OAuthBtn>
              <OAuthBtn href={githubOAuthUrl()}>
                <GithubIcon />
                GitHub
              </OAuthBtn>
            </OAuthRow>
            <Divider><span>or</span></Divider>
            <form onSubmit={handleRegister}>
              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>
              <Field>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              <Field>
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </SubmitBtn>
            </form>
            <Footer>
              Already have an account? <Link to="/login">Sign in</Link>
            </Footer>
            <Footer>
              <Link to="/">← Back to main page</Link>
            </Footer>
          </>
        ) : (
          <>
            <Title>Check your email</Title>
            <Hint>
              We sent a 5-digit code to <strong>{email}</strong>. Enter it below to confirm your account.
            </Hint>
            <form onSubmit={handleVerify}>
              <Field>
                <Label>Verification code</Label>
                <CodeInput
                  type="text"
                  inputMode="numeric"
                  pattern="\d{5}"
                  maxLength={5}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345"
                  required
                  autoFocus
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn type="submit" disabled={loading || code.length < 5}>
                {loading ? 'Verifying…' : 'Confirm email'}
              </SubmitBtn>
            </form>
            <BackLink onClick={() => { setStep('register'); setError(''); setCode(''); }}>
              ← Back
            </BackLink>
          </>
        )}
      </Card>
    </Page>
  );
}

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
`;

const Title = styled.h1`
  margin: 0 0 28px;
  font-size: 24px;
  font-weight: 700;
  color: #111;
`;

const Hint = styled.p`
  margin: -16px 0 24px;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
`;

const Field = styled.div`
  margin-bottom: 16px;
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
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { border-color: #4CAF50; }
`;

const CodeInput = styled(Input)`
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-align: center;
`;

const ErrorMsg = styled.p`
  color: #d32f2f;
  font-size: 13px;
  margin: 0 0 12px;
`;

const SubmitBtn = styled.button`
  width: 100%;
  padding: 11px;
  background: #4CAF50;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: #43a047; }
  &:disabled { background: #ccc; cursor: not-allowed; }
`;

const Footer = styled.p`
  text-align: center;
  font-size: 13px;
  color: #888;
  margin: 24px 0 0;
  a { color: #4CAF50; text-decoration: none; font-weight: 500; }
`;

const OAuthRow = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 4px;
`;

const OAuthBtn = styled.a`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
  &:hover { background: #f5f5f5; border-color: #ccc; }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e0e0e0;
  }
  span { color: #aaa; font-size: 12px; }
`;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

const BackLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin-top: 16px;
  font-size: 13px;
  color: #4CAF50;
  cursor: pointer;
  font-weight: 500;
  &:hover { text-decoration: underline; }
`;
