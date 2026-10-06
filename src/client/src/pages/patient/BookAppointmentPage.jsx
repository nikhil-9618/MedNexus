import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck2, ShieldCheck } from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { PATHS } from '../../routes/paths.js';
import { formatDate, formatTime } from '../../utils/format.js';

export default function BookAppointmentPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const preselected = location.state || {};
  const { data, loading } = useAsync(() => doctorService.get(id), [id]);
  const [date, setDate] = useState(preselected.date || '');
  const [time, setTime] = useState(preselected.time || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const doctor = data?.doctor;

  async function submit(e) {
    e.preventDefault();
    if (!date || !time) { setErr('Pick a date and slot first.'); return; }
    if (reason.trim().length < 5) { setErr('Describe the reason for your visit (at least 5 characters).'); return; }
    setBusy(true);
    setErr('');
    try {
      await appointmentService.book({ doctorId: id, date, time, reason: reason.trim() });
      toast.success('Appointment booked!');
      navigate(PATHS.patient.appointments, { replace: true });
    } catch (ex) {
      setErr(ex?.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader fullScreen label="Preparing booking…" />;
  if (!doctor) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600">Doctor not found.</p>
        <Link to={PATHS.patient.doctors} className="btn-primary mt-4">Back to directory</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to={`${PATHS.patient.doctors}/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div className="card p-6">
        <h2 className="font-display text-xl font-bold text-slate-900">Confirm your appointment</h2>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="font-semibold text-slate-900">{doctor.name} · {doctor.specialization}</p>
          <p className="mt-1 text-sm text-slate-500">
            {date ? `${formatDate(date)} at ${formatTime(time)}` : 'Select a date and slot from the profile page first.'}
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="reason">Reason for visit</label>
            <textarea
              id="reason"
              rows={3}
              className="input resize-none"
              placeholder="e.g. Recurring headaches for the past two weeks"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
            <p className="mt-1 text-xs text-slate-500">{reason.length}/300 characters</p>
          </div>
          {err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{err}</p>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy || !time}>
            <CalendarCheck2 className="h-4 w-4" /> {busy ? 'Booking…' : 'Confirm booking'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Slot availability is re-verified server-side before confirmation.
          </p>
        </form>
      </div>
    </div>
  );
}
