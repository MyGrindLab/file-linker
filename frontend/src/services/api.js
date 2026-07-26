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
