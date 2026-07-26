import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';
import { createCheckoutSession } from '../services/api';

export default function UpgradePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await createCheckoutSession();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Something went wrong');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const isPro = user?.is_paid;
  const isFree = user && !user.is_paid;

  return (
    <>
      <Seo
        title="Pricing"
        description="Compare FileLinker plans for faster file sharing, larger uploads, longer link retention, and preview-friendly delivery."
        path="/pricing"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'OfferCatalog',
          name: 'FileLinker Pricing',
          itemListElement: [
            { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
            { '@type': 'Offer', name: 'Pro', price: '2', priceCurrency: 'USD' },
          ],
        }}
      />
      <Navbar />
      <Page>
        <Heading>Simple pricing</Heading>
        <Subheading>Start free. Upgrade when you need larger files and longer-lived links.</Subheading>
        <Grid>
          <PlanCard>
            <PlanName>Anonymous</PlanName>
            <PlanPrice>$0</PlanPrice>
            <FeatureList>
              <li>10 MB max file size</li>
              <li>1-day link lifetime</li>
              <li>All file formats</li>
              <li>No signup required</li>
            </FeatureList>
            {!user && <CurrentBadge>Current plan</CurrentBadge>}
          </PlanCard>

          <PlanCard>
            <PlanName>Free</PlanName>
            <PlanPrice>$0</PlanPrice>
            <FeatureList>
              <li>10 MB max file size</li>
              <li>10-day link lifetime</li>
              <li>All file formats</li>
              <li>Free account</li>
            </FeatureList>
            {isFree ? (
              <CurrentBadge>Current plan</CurrentBadge>
            ) : (
              !user && (
                <UpgradeBtn onClick={() => navigate('/register')}>
                  Create free account
                </UpgradeBtn>
              )
            )}
          </PlanCard>

          <PlanCard $highlighted>
            <PlanName>Pro</PlanName>
            <PlanPrice>$2 <small>/month</small></PlanPrice>
            <FeatureList>
              <li><strong>100 MB</strong> max file size</li>
              <li><strong>Permanent</strong> links</li>
              <li>All file formats</li>
              <li>Priority support</li>
            </FeatureList>
            {isPro ? (
              <CurrentBadge $active>Current plan</CurrentBadge>
            ) : (
              <>
                {error && <ErrMsg>{error}</ErrMsg>}
                <UpgradeBtn onClick={handleUpgrade} disabled={loading}>
                  {loading ? 'Redirecting…' : user ? 'Upgrade for $2/mo' : 'Get started'}
                </UpgradeBtn>
                {!user && <LoginHint>You'll be asked to log in or create an account.</LoginHint>}
              </>
            )}
          </PlanCard>
        </Grid>
      </Page>
    </>
  );
}

const Page = styled.div`
  max-width: 960px;
  margin: 60px auto;
  padding: 0 20px;
`;

const Heading = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #111;
  margin: 0 0 10px;
  text-align: center;
`;

const Subheading = styled.p`
  max-width: 560px;
  margin: 0 auto 36px;
  text-align: center;
  color: #5d6e66;
  line-height: 1.7;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;

const PlanCard = styled.div`
  border: ${p => p.$highlighted ? '2px solid #4CAF50' : '1px solid #e0e0e0'};
  border-radius: 12px;
  padding: 32px 28px;
  background: ${p => p.$highlighted ? '#fafff9' : '#fff'};
`;

const PlanName = styled.div`
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 8px;
`;

const PlanPrice = styled.div`
  font-size: 36px;
  font-weight: 700;
  color: #111;
  margin-bottom: 24px;
  small { font-size: 14px; font-weight: 400; color: #888; }
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  li {
    font-size: 14px;
    color: #444;
    padding: 6px 0;
    border-bottom: 1px solid #f0f0f0;
    &:last-child { border-bottom: none; }
    &::before { content: '✓ '; color: #4CAF50; }
  }
`;

const UpgradeBtn = styled.button`
  width: 100%;
  padding: 12px;
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

const CurrentBadge = styled.div`
  font-size: 13px;
  color: ${p => p.$active ? '#4CAF50' : '#aaa'};
  font-weight: 600;
  text-align: center;
`;

const LoginHint = styled.p`
  margin: 10px 0 0;
  font-size: 12px;
  color: #aaa;
  text-align: center;
`;

const ErrMsg = styled.p`
  color: #d32f2f;
  font-size: 13px;
  margin: 0 0 10px;
`;
