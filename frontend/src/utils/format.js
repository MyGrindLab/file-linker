const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const KILO = 1024;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Human-readable file size (binary units).
 * 0 -> "0 B", 831488 -> "812 KB", 1468006 -> "1.4 MB"
 *
 * Values >= 100 in their unit lose the decimal ("812 KB"), a trailing ".0" is
 * dropped ("1 MB" not "1.0 MB"). Invalid/negative input yields "0 B".
 *
 * @param {number|null|undefined} n bytes
 * @returns {string}
 */
export function formatBytes(n) {
  const bytes = typeof n === 'string' ? Number(n) : n;
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unit = 0;
  while (value >= KILO && unit < BYTE_UNITS.length - 1) {
    value /= KILO;
    unit += 1;
  }

  const decimals = unit === 0 || value >= 100 ? 0 : 1;
  const text = value.toFixed(decimals).replace(/\.0$/, '');
  return `${text} ${BYTE_UNITS[unit]}`;
}

/**
 * ISO timestamp -> "12 Mar 2026". Empty string for null/invalid input.
 *
 * @param {string|Date|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const date = toDate(iso);
  if (!date) return '';
  return DATE_FORMATTER.format(date);
}

/**
 * Badge text for a file's expiry.
 * null/undefined -> "Permanent", past -> "Expired",
 * future -> "Expires in 6 days" / "Expires in 4 hours" / "Expires in 1 minute".
 * Unparsable input -> "" (nothing sensible to claim).
 *
 * The unit is the largest whole one that fits, floored, so the label never
 * overstates the remaining time.
 *
 * @param {string|Date|null|undefined} expiresAt
 * @param {number} [now=Date.now()] injectable clock for tests
 * @returns {string}
 */
export function expiryLabel(expiresAt, now = Date.now()) {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return 'Permanent';

  const date = toDate(expiresAt);
  if (!date) return '';

  const diff = date.getTime() - now;
  if (diff <= 0) return 'Expired';

  if (diff >= DAY) return `Expires in ${plural(Math.floor(diff / DAY), 'day')}`;
  if (diff >= HOUR) return `Expires in ${plural(Math.floor(diff / HOUR), 'hour')}`;
  if (diff >= MINUTE) return `Expires in ${plural(Math.floor(diff / MINUTE), 'minute')}`;
  return 'Expires in less than a minute';
}

/**
 * "report.final.PDF" -> "PDF", "README" -> "", ".env" -> "" (dotfile, not an extension).
 *
 * @param {string|null|undefined} filename
 * @returns {string}
 */
export function fileExtension(filename) {
  if (typeof filename !== 'string') return '';
  const name = filename.trim().split(/[/\\]/).pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toUpperCase();
}
