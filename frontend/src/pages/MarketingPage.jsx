import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import FileUploader from '../components/FileUploader';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';

function buildSchema(page) {
  const baseUrl = typeof window === 'undefined' ? page.path : `${window.location.origin}${page.path}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: page.title,
        url: baseUrl,
        description: page.description,
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

export default function MarketingPage({ page }) {
  return (
    <>
      <Seo
        title={page.title}
        description={page.description}
        path={page.path}
        schema={buildSchema(page)}
      />
      <Navbar />
      <Shell>
        <Hero>
          <Eyebrow>FileLinker</Eyebrow>
          <h1>{page.hero}</h1>
          <p>{page.description}</p>
          <InlineLinks>
            <Link to="/">Main uploader</Link>
            <Link to="/upgrade">Pricing</Link>
          </InlineLinks>
        </Hero>

        <Section>
          <SectionTitle>Why this page exists</SectionTitle>
          <Lead>{page.intro}</Lead>
          <KeywordRow>
            {page.keywords.map((keyword) => (
              <Keyword key={keyword}>{keyword}</Keyword>
            ))}
          </KeywordRow>
        </Section>

        <UploaderWrap>
          <FileUploader />
        </UploaderWrap>

        <Section>
          <SectionTitle>FAQ</SectionTitle>
          <FaqList>
            {page.faqs.map((faq) => (
              <FaqItem key={faq.question}>
                <h2>{faq.question}</h2>
                <p>{faq.answer}</p>
              </FaqItem>
            ))}
          </FaqList>
        </Section>
      </Shell>
    </>
  );
}

const Shell = styled.main`
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 20px 64px;
`;

const Hero = styled.section`
  padding: 56px 0 24px;
  text-align: left;

  h1 {
    margin: 0 0 16px;
    max-width: 760px;
    font-size: clamp(2.4rem, 5vw, 4.6rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: #101b16;
  }

  p {
    max-width: 720px;
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.7;
    color: #4d6057;
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 12px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1f7a55;
`;

const InlineLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;

  a {
    color: #1f7a55;
    font-weight: 600;
    text-decoration: none;
  }
`;

const Section = styled.section`
  margin-top: 28px;
  padding: 28px;
  border: 1px solid rgba(24, 57, 42, 0.1);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.8);
`;

const UploaderWrap = styled.div`
  margin-top: 28px;
  padding: 12px 0;
`;

const SectionTitle = styled.h2`
  margin: 0 0 14px;
  font-size: 1.5rem;
  color: #101b16;
`;

const Lead = styled.p`
  margin: 0;
  max-width: 760px;
  color: #4d6057;
  line-height: 1.7;
`;

const KeywordRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
`;

const Keyword = styled.span`
  padding: 8px 12px;
  border-radius: 999px;
  background: #edf7f1;
  color: #1f7a55;
  font-size: 0.92rem;
`;

const FaqList = styled.div`
  display: grid;
  gap: 16px;
`;

const FaqItem = styled.article`
  h2 {
    margin: 0 0 8px;
    font-size: 1.08rem;
    color: #101b16;
  }

  p {
    margin: 0;
    color: #4d6057;
    line-height: 1.7;
  }
`;
