const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

function firstString(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

/**
 * Turn a failed Response into a message that is always safe to render.
 *
 * FastAPI is not consistent: a hand-raised HTTPException gives
 * `{ detail: "..." }`, while a 422 validation failure gives
 * `{ detail: [{ loc, msg, type }, ...] }`. Rendering that array in JSX throws
 * ("Objects are not valid as a React child"), so it is flattened here.
 *
 * Resolution order: data.error -> string data.detail -> data.detail[0].msg -> fallback.
 *
 * Never throws: a missing/undefined response, an empty body, a non-JSON body or
 * an already-consumed stream all resolve to `fallback`. Always returns a string.
 *
 * The body is read from `res.clone()` so the caller can still read the original.
 *
 * @param {Response|undefined|null} res
 * @param {string} [fallback]
 * @returns {Promise<string>}
 */
export async function readApiError(res, fallback = DEFAULT_FALLBACK) {
  const safeFallback = firstString(fallback) || DEFAULT_FALLBACK;

  let data;
  try {
    // res is undefined when apiFetch swallowed a 401 and reloaded the page.
    if (!res) return safeFallback;
    const source = typeof res.clone === 'function' ? res.clone() : res;
    if (typeof source.json !== 'function') return safeFallback;
    data = await source.json();
  } catch {
    // Empty body, HTML error page, network abort, stream already consumed.
    return safeFallback;
  }

  if (!data || typeof data !== 'object') {
    return firstString(data) || safeFallback;
  }

  const { error, detail } = data;

  const direct = firstString(error, typeof detail === 'string' ? detail : null);
  if (direct) return direct;

  if (Array.isArray(detail)) {
    for (const item of detail) {
      const msg = firstString(item?.msg, typeof item === 'string' ? item : null);
      if (msg) return msg;
    }
  }

  return safeFallback;
}
