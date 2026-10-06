/** Formatting helpers shared across the UI. */

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export const STATUS_STYLES = {
  Scheduled: 'bg-sky-50 text-sky-700 ring-sky-200',
  Confirmed: 'bg-brand-50 text-brand-700 ring-brand-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function statusClass(status) {
  return STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

export const STATUS_FLOW = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

/** Age from ISO dob. */
export function ageFrom(dob) {
  if (!dob) return '—';
  const d = new Date(`${dob}T00:00:00`);
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}
