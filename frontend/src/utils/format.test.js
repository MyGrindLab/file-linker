import { describe, it, expect } from 'vitest';
import { expiryLabel, fileExtension, formatBytes, formatDate } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe('formatBytes', () => {
  it('renders 0 bytes as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('renders negative or non-finite input as "0 B"', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
  });

  it('keeps whole bytes below 1 KB without a unit conversion', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('converts to KB and drops a trailing ".0"', () => {
    expect(formatBytes(831488)).toBe('812 KB');
  });

  it('converts to MB with one decimal place below 100', () => {
    expect(formatBytes(1468006)).toBe('1.4 MB');
  });

  it('drops the decimal once the unit value reaches 100', () => {
    // 100 MB exactly: >= 100 in its own unit loses the decimal place.
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
  });

  it('accepts a numeric string, since the API can serialize size_bytes as one', () => {
    expect(formatBytes('2048')).toBe('2 KB');
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp as "12 Mar 2026"', () => {
    expect(formatDate('2026-03-12T10:00:00Z')).toBe('12 Mar 2026');
  });

  it('returns an empty string for null, undefined or an empty string', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('returns an empty string for an unparsable date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('expiryLabel', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);

  it('reports "Permanent" for null, undefined or an empty string', () => {
    expect(expiryLabel(null, now)).toBe('Permanent');
    expect(expiryLabel(undefined, now)).toBe('Permanent');
    expect(expiryLabel('', now)).toBe('Permanent');
  });

  it('reports "Expired" once the timestamp is in the past', () => {
    expect(expiryLabel(new Date(now - 1000).toISOString(), now)).toBe('Expired');
  });

  it('returns an empty string for an unparsable timestamp', () => {
    expect(expiryLabel('not-a-date', now)).toBe('');
  });

  it('floors to whole days, so 6.5 days out reads as "Expires in 6 days"', () => {
    // A fixture of exactly 6 days would sit on the boundary and be flaky
    // against floating point/clock jitter; 6.5 days keeps floor() stable.
    const expiresAt = new Date(now + 6.5 * DAY_MS).toISOString();
    expect(expiryLabel(expiresAt, now)).toBe('Expires in 6 days');
  });

  it('uses the singular "day" for exactly one day remaining', () => {
    const expiresAt = new Date(now + 1.5 * DAY_MS).toISOString();
    expect(expiryLabel(expiresAt, now)).toBe('Expires in 1 day');
  });

  it('falls back to hours once under a day remains', () => {
    const expiresAt = new Date(now + 4.5 * HOUR_MS).toISOString();
    expect(expiryLabel(expiresAt, now)).toBe('Expires in 4 hours');
  });

  it('falls back to minutes once under an hour remains', () => {
    const expiresAt = new Date(now + 5.5 * MINUTE_MS).toISOString();
    expect(expiryLabel(expiresAt, now)).toBe('Expires in 5 minutes');
  });

  it('reports "less than a minute" for anything under a minute', () => {
    const expiresAt = new Date(now + 30 * 1000).toISOString();
    expect(expiryLabel(expiresAt, now)).toBe('Expires in less than a minute');
  });
});

describe('fileExtension', () => {
  it('uppercases the extension after the last dot', () => {
    expect(fileExtension('report.final.PDF')).toBe('PDF');
  });

  it('returns an empty string when there is no extension', () => {
    expect(fileExtension('README')).toBe('');
  });

  it('treats a leading dot as a dotfile, not an extension', () => {
    expect(fileExtension('.env')).toBe('');
  });

  it('returns an empty string for non-string input', () => {
    expect(fileExtension(null)).toBe('');
    expect(fileExtension(undefined)).toBe('');
  });
});
