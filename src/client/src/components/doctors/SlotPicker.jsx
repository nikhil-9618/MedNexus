import { useEffect, useMemo, useState } from 'react';
import { doctorService } from '../../services/doctorService.js';
import { apiError } from '../../services/api.js';
import { formatDate, formatTime } from '../../utils/format.js';
import { Spinner } from '../common/Loader.jsx';
import { CalendarDays, CalendarX2 } from 'lucide-react';

/** Next N bookable dates starting today. */
export function nextDays(n = 14) {
  const out = [];
  const start = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function SlotPicker({ doctorId, date, onDateChange, onSlotPick, selectedTime }) {
  const days = useMemo(() => nextDays(14), []);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!doctorId || !date) return;
    let live = true;
    setLoading(true);
    setError('');
    doctorService.availability(doctorId, { date })
      .then((res) => { if (live) setSlots(res.data.slots || []); })
      .catch((err) => { if (live) setError(apiError(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [doctorId, date]);

  const free = slots.filter((s) => s.available).length;

  return (
    <div>
      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const dt = new Date(`${d}T00:00:00`);
          const active = d === date;
          return (
            <button
              key={d}
              onClick={() => onDateChange(d)}
              className={`flex w-[68px] shrink-0 flex-col items-center rounded-xl px-2 py-2.5 text-xs font-semibold ring-1 transition-all ${
                active ? 'bg-brand-600 text-white ring-brand-600 shadow-card' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'
              }`}
            >
              <span className={active ? 'text-brand-100' : 'text-slate-500'}>{dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="mt-0.5 text-base">{dt.getDate()}</span>
              <span className={active ? 'text-brand-100' : 'text-slate-500'}>{dt.toLocaleDateString(undefined, { month: 'short' })}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{formatDate(date)}</p>
          {!loading && !error && (
            <p className={`text-xs font-semibold ${free > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {free > 0 ? `${free} slot${free > 1 ? 's' : ''} free` : 'Fully booked'}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Loading slots…</div>
        ) : error ? (
          <p className="py-2 text-sm text-rose-600">{error}</p>
        ) : free === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500 ring-1 ring-slate-100">
            <CalendarX2 className="h-5 w-5 text-slate-500" /> No available slots on this date — pick another day above.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => onSlotPick(s.time)}
                className={`rounded-lg px-2 py-2.5 text-xs font-semibold ring-1 transition-all ${
                  selectedTime === s.time ? 'bg-brand-600 text-white ring-brand-600 shadow-card'
                  : s.available ? 'bg-white text-slate-700 ring-slate-200 hover:ring-brand-400 hover:text-brand-700'
                  : 'cursor-not-allowed bg-slate-50 text-slate-300 ring-slate-100 line-through'
                }`}
              >
                {formatTime(s.time)}
              </button>
            ))}
          </div>
        )}
        {!loading && free > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" /> All times are clinic local time.
          </p>
        )}
      </div>
    </div>
  );
}
