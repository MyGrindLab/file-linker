import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { cancelSubscription, changePassword, getMe } from '../services/api';

export default function SettingsPage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    getMe()
      .then(r => r.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [user, navigate]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.detail || 'Failed to change password');
      }
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelError('');
    setCancelling(true);
    try {
      const res = await cancelSubscription();
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.detail || 'Failed to cancel subscription');
      }
      await refresh();
      setCancelConfirm(false);
      setProfile(p => ({ ...p, is_paid: false }));
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Seo title="Settings" description="Manage your FileLinker account settings." path="/settings" noindex />
      <Navbar />
      <Page>
        <Heading>Account settings</Heading>

        <Card>
          <SectionTitle>Profile</SectionTitle>
          {loadingProfile ? (
            <Muted>Loading…</Muted>
          ) : profile ? (
            <InfoGrid>
              <InfoRow>
                <InfoLabel>Email</InfoLabel>
                <InfoValue>{profile.email}</InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoLabel>Plan</InfoLabel>
                <InfoValue>
                  {profile.is_paid ? <ProBadge>Pro</ProBadge> : <FreeBadge>Free</FreeBadge>}
                </InfoValue>
              </InfoRow>
              {profile.oauth_provider && (
                <InfoRow>
                  <InfoLabel>Connected via</InfoLabel>
                  <InfoValue>{profile.oauth_provider.charAt(0).toUpperCase() + profile.oauth_provider.slice(1)}</InfoValue>
                </InfoRow>
              )}
              <InfoRow>
                <InfoLabel>Member since</InfoLabel>
                <InfoValue>{new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</InfoValue>
              </InfoRow>
            </InfoGrid>
          ) : (
            <Muted>Could not load profile.</Muted>
          )}
        </Card>

        {profile && !profile.oauth_provider && (
          <Card>
            <SectionTitle>Change password</SectionTitle>
            <form onSubmit={handlePasswordChange}>
              <Field>
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              <Field>
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              <Field>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
              {passwordError && <ErrorMsg>{passwordError}</ErrorMsg>}
              {passwordSuccess && <SuccessMsg>Password updated successfully.</SuccessMsg>}
              <SaveBtn type="submit" disabled={savingPassword}>
                {savingPassword ? 'Saving…' : 'Save password'}
              </SaveBtn>
            </form>
          </Card>
        )}

        {profile?.is_paid && (
          <Card $danger>
            <SectionTitle>Subscription</SectionTitle>
            <p style={{ color: '#4d6057', fontSize: '14px', marginTop: 0 }}>
              You are on the <strong>Pro plan</strong>. Cancelling will remove your 100 MB upload limit and permanent links at the end of the billing period.
            </p>
            {!cancelConfirm ? (
              <DangerBtn onClick={() => setCancelConfirm(true)}>
                Cancel subscription
              </DangerBtn>
            ) : (
              <>
                <ConfirmText>Are you sure? This cannot be undone.</ConfirmText>
                {cancelError && <ErrorMsg>{cancelError}</ErrorMsg>}
                <ButtonRow>
                  <DangerBtn onClick={handleCancelSubscription} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </DangerBtn>
                  <GhostBtn onClick={() => { setCancelConfirm(false); setCancelError(''); }}>
                    Keep plan
                  </GhostBtn>
                </ButtonRow>
              </>
            )}
          </Card>
        )}

        <DangerZone>
          <SectionTitle>Session</SectionTitle>
          <GhostBtn onClick={() => { logout(); navigate('/'); }}>Log out</GhostBtn>
        </DangerZone>
      </Page>
    </>
  );
}

const Page = styled.div`
  max-width: 580px;
  margin: 48px auto;
  padding: 0 20px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Heading = styled.h1`
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  color: #101b16;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid ${p => p.$danger ? 'rgba(211,47,47,0.2)' : 'rgba(24,57,42,0.1)'};
  border-radius: 16px;
  padding: 28px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: #101b16;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const InfoGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const InfoLabel = styled.span`
  font-size: 13px;
  color: #7e8f87;
  width: 120px;
  flex-shrink: 0;
`;

/* The label column is a fixed 120px, so at 320px an unbroken value (an email
   address has no break opportunity) would otherwise push the page sideways. */
const InfoValue = styled.span`
  font-size: 14px;
  color: #1b2e25;
  font-weight: 500;
  min-width: 0;
  overflow-wrap: anywhere;
`;

const ProBadge = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1f7a55;
  background: #edf7f1;
  border: 1px solid #caead8;
  border-radius: 999px;
  padding: 3px 10px;
`;

const FreeBadge = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #888;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 999px;
  padding: 3px 10px;
`;

const Muted = styled.p`
  color: #aaa;
  font-size: 14px;
  margin: 0;
`;

const Field = styled.div`
  margin-bottom: 14px;
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

const SaveBtn = styled.button`
  padding: 10px 20px;
  background: #4CAF50;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: #43a047; }
  &:disabled { background: #ccc; cursor: not-allowed; }
`;

const DangerBtn = styled.button`
  padding: 10px 20px;
  background: #d32f2f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: #b71c1c; }
  &:disabled { background: #ccc; cursor: not-allowed; }
`;

const GhostBtn = styled.button`
  padding: 10px 20px;
  background: none;
  color: #496052;
  border: 1px solid rgba(24,57,42,0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #f5f5f5; }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const ConfirmText = styled.p`
  font-size: 14px;
  color: #d32f2f;
  margin: 0 0 12px;
  font-weight: 500;
`;

const ErrorMsg = styled.p`
  color: #d32f2f;
  font-size: 13px;
  margin: 0 0 12px;
`;

const SuccessMsg = styled.p`
  color: #1f7a55;
  font-size: 13px;
  margin: 0 0 12px;
`;

const DangerZone = styled.div`
  padding: 28px;
  border: 1px solid rgba(24,57,42,0.1);
  border-radius: 16px;
  background: #fff;
`;
