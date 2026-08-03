import { emitToast } from '../utils/toast';

const BASE = import.meta.env.VITE_API_BASE_URL;

function getToken() {
  return localStorage.getItem('token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    return;
  }

  if (!res.ok) {
    res.clone().json().then(data => {
      if (data?.error) emitToast(data.error);
    }).catch(() => {});
  }

  return res;
}

export async function uploadFile(file, password = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (password) formData.append('password', password);
  return apiFetch('/file/upload/', { method: 'POST', body: formData });
}

export async function createCheckoutSession() {
  return apiFetch('/payment/checkout/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function loginUser(email, password) {
  return fetch(`${BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email, password) {
  return fetch(`${BASE}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyEmail(email, code) {
  return fetch(`${BASE}/auth/verify-email/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: parseInt(code, 10) }),
  });
}

export function googleOAuthUrl() {
  return `${BASE}/auth/google/`;
}

export function githubOAuthUrl() {
  return `${BASE}/auth/github/`;
}

export async function refreshToken() {
  return apiFetch('/auth/refresh/', { method: 'POST' });
}

export async function getMe() {
  return apiFetch('/user/me/');
}

export async function changePassword(old_password, new_password) {
  return apiFetch('/user/password/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_password, new_password }),
  });
}

export async function cancelSubscription() {
  return apiFetch('/payment/cancel/', { method: 'POST' });
}

/**
 * @typedef {Object} FileInfo
 * @property {string} short_id
 * @property {string} original_filename
 * @property {number} size_bytes
 * @property {string} uploaded_at        ISO 8601
 * @property {string|null} expires_at    ISO 8601, null when permanent
 * @property {boolean} has_password
 * @property {boolean} is_active
 * @property {string} link
 */

/**
 * @typedef {Object} FileListPage
 * @property {FileInfo[]} items
 * @property {number} total
 */

/**
 * GET /file/my/ — one page of the current user's files.
 * 200 -> { items: FileInfo[], total: number }
 *
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @param {{ signal?: AbortSignal }} [options] pass an AbortSignal to cancel in-flight requests
 * @returns {Promise<Response|undefined>} undefined when apiFetch handled a 401
 */
export async function listMyFiles(limit = 20, offset = 0, { signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiFetch(`/file/my/?${query.toString()}`, { signal });
}

/**
 * PUT /file/{short_id}/content/ — swap the stored bytes, keep the short id/link.
 * 200 -> FileInfo
 *
 * Content-Type is intentionally omitted so the browser sets the multipart boundary.
 *
 * @param {string} shortId
 * @param {File|Blob} file
 * @returns {Promise<Response|undefined>}
 */
export async function replaceFileContent(shortId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch(`/file/${encodeURIComponent(shortId)}/content/`, {
    method: 'PUT',
    body: formData,
  });
}

/**
 * PUT /file/{short_id}/password/ — set or change the download password.
 * 204 -> no body
 *
 * @param {string} shortId
 * @param {string} password
 * @returns {Promise<Response|undefined>}
 */
export async function setFilePassword(shortId, password) {
  return apiFetch(`/file/${encodeURIComponent(shortId)}/password/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

/**
 * DELETE /file/{short_id}/password/ — drop the password protection.
 * 204 -> no body
 *
 * @param {string} shortId
 * @returns {Promise<Response|undefined>}
 */
export async function removeFilePassword(shortId) {
  return apiFetch(`/file/${encodeURIComponent(shortId)}/password/`, { method: 'DELETE' });
}

/**
 * DELETE /file/{short_id}/ — delete the file.
 * 204 -> no body
 *
 * @param {string} shortId
 * @returns {Promise<Response|undefined>}
 */
export async function deleteFile(shortId) {
  return apiFetch(`/file/${encodeURIComponent(shortId)}/`, { method: 'DELETE' });
}
