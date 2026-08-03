import { describe, it, expect } from 'vitest';
import { readApiError } from './apiError';

function jsonResponse(body, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readApiError', () => {
  it('prefers data.error over everything else', () => {
    return readApiError(jsonResponse({ error: 'Top-level error', detail: 'Ignored' })).then(
      (message) => expect(message).toBe('Top-level error')
    );
  });

  it('returns a string detail as-is', async () => {
    const message = await readApiError(jsonResponse({ detail: 'Not found' }));
    expect(message).toBe('Not found');
  });

  it('flattens a FastAPI validation array (detail: [{msg, loc, type}]) to its first message', async () => {
    // This is the crash-prevention case: FastAPI 422s put an array of objects
    // in `detail`. Rendering that array directly in JSX throws ("Objects are
    // not valid as a React child") and, before flattening, would otherwise
    // stringify to the literal text "[object Object]".
    const res = jsonResponse(
      {
        detail: [
          { loc: ['body', 'password'], msg: 'ensure this value has at least 4 characters', type: 'value_error' },
          { loc: ['body', 'password'], msg: 'a second, ignored error', type: 'value_error' },
        ],
      },
      422
    );

    const message = await readApiError(res);

    expect(message).toBe('ensure this value has at least 4 characters');
    expect(message).not.toContain('[object Object]');
    expect(message).not.toContain('object Object');
  });

  it('skips array items with no usable msg and falls through to the fallback', async () => {
    const res = jsonResponse({ detail: [{ loc: ['body'], type: 'value_error' }] }, 422);
    const message = await readApiError(res, 'Fallback message');
    expect(message).toBe('Fallback message');
  });

  it('falls back to the default message when the response has no body', async () => {
    const res = new Response(null, { status: 500 });
    const message = await readApiError(res);
    expect(message).toBe('Something went wrong. Please try again.');
  });

  it('falls back to a caller-supplied message when the body is not JSON', async () => {
    const res = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    const message = await readApiError(res, 'Could not load your files. Please try again.');
    expect(message).toBe('Could not load your files. Please try again.');
  });

  it('never throws and falls back to the default message when res is undefined', async () => {
    // apiFetch resolves to undefined when it swallowed a 401.
    await expect(readApiError(undefined)).resolves.toBe('Something went wrong. Please try again.');
  });

  it('does not consume the original response body (reads via a clone)', async () => {
    const res = jsonResponse({ detail: 'Conflict' }, 409);
    await readApiError(res);
    // If readApiError had read `res` directly instead of `res.clone()`, this
    // second read would throw/hang on an already-consumed stream.
    await expect(res.json()).resolves.toEqual({ detail: 'Conflict' });
  });
});
