import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

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
