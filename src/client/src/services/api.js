import axios from 'axios';

// Same-origin "/api" by default: the Vite dev proxy and the production nginx
// container both forward it to the Express server, so no hostname is baked in.
// Set VITE_API_URL only when the API lives on a different origin (e.g. Render).
const baseURL = (import.meta.env.VITE_API_URL || '').trim() || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

/** Extract a human-friendly message from an API error. */
export function apiError(err) {
  return err?.response?.data?.message
    || err?.message
    || 'Something went wrong. Please try again.';
}

/** Extract field-level validation details if present. */
export function apiFieldErrors(err) {
  const details = err?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  const out = {};
  details.forEach((d) => { out[d.field] = d.message; });
  return out;
}
