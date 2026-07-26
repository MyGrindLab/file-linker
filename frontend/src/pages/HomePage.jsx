import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import FileUploader from '../components/FileUploader';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';

const FORMAT_CATEGORIES = [
  { label: 'Images', exts: ['JPG', 'PNG', 'GIF', 'WEBP'] },
  { label: 'Videos', exts: ['MP4', 'WEBM', 'OGG', 'MOV'] },
  { label: 'Documents', exts: ['PDF'] },
  { label: 'Text', exts: ['HTML', 'TXT', 'LOG', 'CSV', 'JSON', 'XML'] },
];

function HomePage() {
  const { user, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setSearchParams({}, { replace: true });
      refresh().then(() => setPaymentSuccess(true));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Seo
        title="Fast File Sharing With Preview And Expiring Links"
        description="Upload files, get instant shareable links, preview images, video, PDF, and text online, and use automatic expiration for cleaner file delivery."
        path="/"
        schema={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: 'FileLinker',
              url: typeof window === 'undefined' ? '/' : window.location.origin,
            },
            {
              '@type': 'SoftwareApplication',
              name: 'FileLinker',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'File uploading and link sharing app with preview for images, video, PDF, and text files.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            },
          ],
        }}
      />
      <Navbar />
      <div className="app">
        <Hero>
          <Eyebrow>Fast file delivery</Eyebrow>
          <h1>Upload once. Share a clean link instantly.</h1>
          <Subtitle>
            FileLinker helps you upload images, video, PDF, and text files, preview them online, and share expiring links without the friction of a full cloud drive.
          </Subtitle>
          <HeroLinks>
            <Link to="/pricing">See pricing</Link>
            <Link to="/register">Get started free</Link>
          </HeroLinks>
          <FormatCategories>
            {FORMAT_CATEGORIES.map(({ label, exts }) => (
              <FormatChip key={label}>
                <ChipLabel>{label}</ChipLabel>
                <ChipExts>{exts.join(' · ')}</ChipExts>
              </FormatChip>
            ))}
          </FormatCategories>
        </Hero>

        {paymentSuccess && (
          <SuccessBanner>
            Payment confirmed! You now have <strong>100 MB uploads</strong> and <strong>permanent links</strong>.
          </SuccessBanner>
        )}

        {!paymentSuccess && user && !user.is_paid && (
          <UpgradeBanner>
            Get <strong>100 MB uploads</strong> and <strong>permanent links</strong> for a $2/month subscription.{' '}
            <Link to="/upgrade">Upgrade →</Link>
          </UpgradeBanner>
        )}

        <FileUploader />

        <SectionGrid>
          <InfoCard>
            <h2>Expiring links</h2>
            <p>Upload a file, get a public link, and let it expire automatically — no folders, invites, or permissions needed.</p>
          </InfoCard>
          <InfoCard>
            <h2>PDFs, images & more</h2>
            <p>Share screenshots, proposals, mockups, and video clips with a direct browser-friendly link and inline preview.</p>
          </InfoCard>
          <InfoCard>
            <h2>Anonymous or account-based</h2>
            <p>Upload without signup for speed, then create an account when you need larger limits, longer retention, and paid plan upgrades.</p>
          </InfoCard>
        </SectionGrid>

        <UseCasesSection>
          <SectionHeading>Popular use cases</SectionHeading>
          <UseCaseList>
            <UseCaseCard>
              <h2>Share video clips</h2>
              <p>Upload demos and short recordings, then let teammates or clients watch them immediately in the browser.</p>
            </UseCaseCard>
            <UseCaseCard>
              <h2>Upload without signup</h2>
              <p>Drop a file, copy the link, and move on — no account needed for quick one-off sharing.</p>
            </UseCaseCard>
            <UseCaseCard>
              <h2>Share PDFs & images</h2>
              <p>Send proposals, screenshots, and mockups through a single public link with inline preview.</p>
            </UseCaseCard>
            <UseCaseCard>
              <h2>Pass logs & data files</h2>
              <p>Share CSV, JSON, XML, and log files with support teams or collaborators via a clean URL.</p>
            </UseCaseCard>
          </UseCaseList>
        </UseCasesSection>

      </div>
    </>
  );
}

const Hero = styled.div`
  text-align: center;
  padding: 52px 0 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  h1 {
    max-width: 820px;
    font-size: clamp(2.8rem, 6vw, 5.5rem);
    font-weight: 700;
    line-height: 0.94;
    letter-spacing: -0.05em;
    color: #101b16;
    margin: 0 0 12px;
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #1f7a55;
`;

const Subtitle = styled.p`
  max-width: 720px;
  font-size: 18px;
  line-height: 1.7;
  color: #4d6057;
  margin: 0 0 18px;
`;

const HeroLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  justify-content: center;

  a {
    color: #1f7a55;
    font-weight: 600;
    text-decoration: none;
  }
`;

const FormatCategories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 4px;
`;

const ChipExts = styled.span`
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  transition: max-width 0.35s ease, opacity 0.25s ease, margin 0.35s ease;
  font-size: 11px;
  color: #4d6057;
  letter-spacing: 0.04em;
`;

const FormatChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(24, 57, 42, 0.15);
  background: rgba(255, 255, 255, 0.7);
  cursor: default;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: #4CAF50;
    background: #f0faf0;

    ${ChipExts} {
      max-width: 200px;
      opacity: 1;
      margin-left: 6px;
    }
  }
`;

const ChipLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1f7a55;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const SuccessBanner = styled.div`
  max-width: 900px;
  margin: 20px auto 0;
  padding: 12px 20px;
  background: #edf7f1;
  border: 1px solid #caead8;
  border-radius: 16px;
  font-size: 14px;
  color: #1f6a49;
  text-align: center;
`;

const UpgradeBanner = styled.div`
  max-width: 900px;
  margin: 20px auto 0;
  padding: 12px 20px;
  background: #fff8e7;
  border: 1px solid #f0dfaa;
  border-radius: 16px;
  font-size: 14px;
  color: #7a5c1f;
  text-align: center;
  a {
    color: #7a5c1f;
    font-weight: 600;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

const SectionGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 24px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const InfoCard = styled.article`
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(24, 57, 42, 0.08);

  h2 {
    margin: 0 0 10px;
    font-size: 1.15rem;
    color: #101b16;
  }

  p {
    margin: 0;
    color: #4d6057;
    line-height: 1.7;
  }
`;

const UseCasesSection = styled.section`
  margin-top: 28px;
`;

const SectionHeading = styled.h2`
  margin: 0 0 16px;
  font-size: 1.8rem;
  color: #101b16;
`;

const UseCaseList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const UseCaseCard = styled.div`
  padding: 24px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid rgba(24, 57, 42, 0.08);

  h2 {
    margin: 0 0 10px;
    font-size: 1.2rem;
    color: #101b16;
  }

  p {
    margin: 0;
    color: #4d6057;
    line-height: 1.7;
  }
`;


export default HomePage;
