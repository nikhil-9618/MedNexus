import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import { appointmentService } from '../../services/appointmentService.js';
import { apiError } from '../../services/api.js';
import { formatDate, formatTime } from '../../utils/format.js';
import { Spinner } from '../common/Loader.jsx';

export default function RescheduleModal({ appointment, open, onClose, onDone }) {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (appointment && open) {
      setDate(appointment.date);
      setTime('');
    }
  }, [appointment, open]);

  useEffect(() => {
    if (!appointment || !date || !open) return;
    let live = true;
    setLoading(true);
    setError('');
    appointmentService.doctorAvailabilityFor(appointment.doctor?.id || appointment.doctorId, date)
      .then((res) => { if (live) setSlots(res.data.slots || []); })
      .catch((err) => { if (live) setError(apiError(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [appointment, date, open]);

  async function submit(e) {
    e.preventDefault();
    if (!time) return;
    setSaving(true);
    try {
      await appointmentService.update(appointment.id, { date, time });
      onDone?.(`Moved to ${formatDate(date)} ${formatTime(time)}`);
      onClose();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reschedule appointment">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="rs-date">New date</label>
          <input id="rs-date" type="date" className="input" value={date} min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setTime(''); setDate(e.target.value); }} required />
        </div>
        <div>
          <span className="label">Available slots</span>
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Loading slots…</div>
          ) : error ? (
            <p className="py-2 text-sm text-rose-600">{error}</p>
          ) : slots.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">The doctor has no slots on this date. Try another day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  disabled={!s.available}
                  onClick={() => setTime(s.time)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold ring-1 transition-colors ${
                    time === s.time ? 'bg-brand-600 text-white ring-brand-600'
                    : s.available ? 'bg-white text-slate-700 ring-slate-200 hover:ring-brand-400'
                    : 'cursor-not-allowed bg-slate-50 text-slate-300 ring-slate-100 line-through'
                  }`}
                >
                  {formatTime(s.time).replace(':00', '')}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Back</button>
          <button type="submit" className="btn-primary" disabled={!time || saving}>{saving ? 'Rescheduling…' : 'Confirm new time'}</button>
        </div>
      </form>
    </Modal>
  );
}
