import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

/**
 * Appointment card.
 * onView -> details modal; onCancel/onReschedule/onStatus optional.
 */
export default function AppointmentCard({ appointment, role, onView, onCancel, onReschedule, onStatus, busy }) {
  const a = appointment;
  const canCancel = ['Scheduled', 'Confirmed'].includes(a.status) && (role === 'PATIENT' || role === 'ADMIN');
  const canReschedule = ['Scheduled', 'Confirmed'].includes(a.status) && (role === 'PATIENT' || role === 'ADMIN');

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{formatDate(a.date)} · {formatTime(a.time)}</p>
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {role === 'DOCTOR' ? `Patient: ${a.patient?.name || '—'} (${a.patient?.patientId || ''})` : `Doctor: ${a.doctor?.name || '—'} · ${a.doctor?.specialization || ''}`}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600"><span className="font-medium text-slate-500">Reason:</span> {a.reason}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button className="btn-secondary px-3 py-2 text-xs" onClick={() => onView(a)}>Details</button>
          {onReschedule && canReschedule && (
            <button className="btn-secondary px-3 py-2 text-xs" onClick={() => onReschedule(a)}>Reschedule</button>
          )}
          {onStatus && role === 'DOCTOR' && a.status === 'Scheduled' && (
            <button className="btn-primary px-3 py-2 text-xs" disabled={busy} onClick={() => onStatus(a, 'Confirmed')}>Confirm</button>
          )}
          {onStatus && role === 'DOCTOR' && ['Scheduled', 'Confirmed'].includes(a.status) && (
            <button className="btn-primary px-3 py-2 text-xs" disabled={busy} onClick={() => onStatus(a, 'Completed')}>Complete</button>
          )}
          {onCancel && canCancel && (
            <button className="btn-secondary px-3 py-2 text-xs text-rose-600 ring-rose-200 hover:bg-rose-50" disabled={busy} onClick={() => onCancel(a)}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
