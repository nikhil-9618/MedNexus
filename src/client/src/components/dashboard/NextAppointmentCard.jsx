import { CalendarClock, Video } from 'lucide-react';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

export default function NextAppointmentCard({ appointment, role, onOpen }) {
  if (!appointment) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-card">
        <p className="text-sm font-semibold text-brand-100">Next appointment</p>
        <p className="mt-2 font-display text-xl font-bold">No upcoming appointments</p>
        <p className="mt-1 text-sm text-brand-100/80">
          {role === 'PATIENT' ? 'Book a visit from the Find Doctor page.' : 'New bookings will appear here.'}
        </p>
      </div>
    );
  }
  const a = appointment;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-card">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-100">Next appointment</p>
          <StatusBadge status={a.status} />
        </div>
        <p className="mt-3 font-display text-2xl font-bold">{formatDate(a.date)}</p>
        <p className="mt-0.5 text-sm text-brand-100/90">{formatTime(a.time)} · {a.doctor?.name || a.patient?.name}</p>
        <p className="mt-1 line-clamp-1 text-sm text-brand-100/70">{a.reason}</p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => onOpen?.(a)} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold ring-1 ring-white/20 backdrop-blur hover:bg-white/20">
            View details
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-100/80">
            <Video className="h-3.5 w-3.5" /> In-clinic visit
          </span>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-brand-100/60">
          <CalendarClock className="h-3.5 w-3.5" /> Arrive 10 minutes early with your ID.
        </p>
      </div>
    </div>
  );
}
