import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Stethoscope, CalendarDays, CalendarCheck2,
  FileText, BadgeCheck, ArrowLeft, ArrowRight, Check, ShieldCheck,
} from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { appointmentService } from '../../services/appointmentService.js';
import { api, apiError } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import DoctorCard from '../../components/doctors/DoctorCard.jsx';
import { nextDays } from '../../components/doctors/SlotPicker.jsx';
import { Spinner } from '../../components/common/Loader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { PATHS } from '../../routes/paths.js';
import { formatDate, formatTime } from '../../utils/format.js';

const SPECIALIZATIONS = ['Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'General Medicine', 'Neurology', 'ENT', 'Ophthalmology'];
const STEPS = [
  { label: 'Select Doctor', icon: Stethoscope },
  { label: 'Select Date', icon: CalendarDays },
  { label: 'Select Slot', icon: CalendarCheck2 },
  { label: 'Enter Reason', icon: FileText },
  { label: 'Confirm', icon: BadgeCheck },
];

export default function BookingWizardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);

  // Step 1 — doctor selection
  const [q, setQ] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q);
  const doctorParams = { page, limit: 6 };
  if (debouncedQ) doctorParams.q = debouncedQ;
  if (specialization) doctorParams.specialization = specialization;
  const { data: doctors, loading: doctorsLoading } = useAsync(() => doctorService.list(doctorParams), [debouncedQ, specialization, page]);

  // Selection state
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 2/3 — availability
  const days = useMemo(() => nextDays(14), []);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  useEffect(() => {
    if (step < 2 || !doctor || !date) { setSlots([]); return; }
    let live = true;
    setSlotsLoading(true);
    setSlotsError('');
    doctorService.availability(doctor.id, { date })
      .then((res) => { if (live) setSlots(res.data.slots || []); })
      .catch((err) => { if (live) setSlotsError(apiError(err)); })
      .finally(() => { if (live) setSlotsLoading(false); });
    return () => { live = false; };
  }, [step, doctor, date]);

  function pickDoctor(d) {
    setDoctor(d);
    setStep(1);
  }

  function pickDate(v) {
    setDate(v);
    setTime('');
    setStep(2);
  }

  function pickSlot(v) {
    setTime(v);
    setStep(3);
  }

  const reasonValid = reason.trim().length >= 5;

  async function confirm(e) {
    e.preventDefault();
    setReasonTouched(true);
    if (!reasonValid) return;
    setStep(4);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      await appointmentService.book({ doctorId: doctor.id, date, time, reason: reason.trim() });
      toast.success('Appointment booked successfully.');
      navigate(PATHS.patient.appointments, { replace: true });
    } catch (err) {
      setSubmitError(apiError(err));
      // Slot may have been taken since selection — allow re-picking
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue =
    (step === 0 && !!doctor) ||
    (step === 1 && !!date) ||
    (step === 2 && !!time) ||
    (step === 3 && reasonValid);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Book Appointment</h2>
        <p className="mt-0.5 text-sm text-slate-500">Five quick steps — availability is verified by the server before anything is saved.</p>
      </div>

      {/* Progress indicator */}
      <ol className="card flex items-center gap-1 overflow-x-auto p-3" aria-label="Booking progress">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors ${
                  done ? 'bg-emerald-600 text-white ring-emerald-600'
                    : active ? 'bg-brand-600 text-white ring-brand-600 shadow-card'
                    : 'bg-white text-slate-500 ring-slate-200'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </span>
              <span className={`hidden whitespace-nowrap text-xs font-semibold sm:block ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                {i + 1}. {s.label}
              </span>
              {i < STEPS.length - 1 && <span className={`mx-1 h-px flex-1 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>

      {/* STEP 1 — Select doctor */}
      {step === 0 && (
        <section className="card p-5" aria-label="Select doctor">
          <h3 className="font-bold text-slate-900">Select a doctor</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Search by doctor name or specialization…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>
            <select className="input md:w-56" value={specialization} onChange={(e) => { setSpecialization(e.target.value); setPage(1); }}>
              <option value="">All specializations</option>
              {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {doctorsLoading ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : (doctors?.items || []).length === 0 ? (
            <div className="mt-5">
              <EmptyState icon={Stethoscope} title="No doctors found" description="Try clearing your search or choosing another specialization." />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {doctors.items.map((d) => (
                <div key={d.id} className="relative">
                  <DoctorCard doctor={d} onBook={pickDoctor} />
                  {doctor?.id === d.id && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-600 p-1 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {doctors?.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="text-xs font-semibold text-slate-500">Page {page} of {doctors.pages}</span>
              <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= doctors.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </section>
      )}

      {/* STEP 2 — Select date */}
      {step === 1 && doctor && (
        <section className="card p-5" aria-label="Select date">
          <h3 className="font-bold text-slate-900">Pick a date with {doctor.name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{doctor.specialization} · {doctor.department}</p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00`);
              const active = d === date;
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
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
        </section>
      )}

      {/* STEP 3 — Select slot */}
      {step === 2 && doctor && date && (
        <section className="card p-5" aria-label="Select slot">
          <h3 className="font-bold text-slate-900">Choose a time slot</h3>
          <p className="mt-0.5 text-sm text-slate-500">{formatDate(date)} · {doctor.name}</p>
          <div className="mt-4">
            {slotsLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Checking availability…</div>
            ) : slotsError ? (
              <p className="py-2 text-sm text-rose-600">{slotsError}</p>
            ) : slots.filter((s) => s.available).length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 px-4 py-8 text-sm text-slate-500 ring-1 ring-slate-100">
                <CalendarDays className="h-6 w-6 text-slate-500" />
                <p>No free slots on this date. Pick another day.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    disabled={!s.available}
                    onClick={() => pickSlot(s.time)}
                    className={`rounded-lg px-2 py-2.5 text-xs font-semibold ring-1 transition-all ${
                      time === s.time ? 'bg-brand-600 text-white ring-brand-600 shadow-card'
                        : s.available ? 'bg-white text-slate-700 ring-slate-200 hover:ring-brand-400 hover:text-brand-700'
                        : 'cursor-not-allowed bg-slate-50 text-slate-300 ring-slate-100 line-through'
                    }`}
                  >
                    {formatTime(s.time)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 4 — Enter reason */}
      {step === 3 && doctor && date && time && (
        <form onSubmit={confirm} className="card space-y-4 p-5" aria-label="Enter reason">
          <h3 className="font-bold text-slate-900">Reason for your visit</h3>
          <label className="label" htmlFor="wizard-reason">Briefly describe your symptoms or reason</label>
          <textarea
            id="wizard-reason"
            rows={4}
            className="input resize-none"
            placeholder="e.g. Recurring headaches for the past two weeks"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setReasonTouched(true)}
            aria-invalid={reasonTouched && !reasonValid}
          />
          <div className="flex items-center justify-between text-xs">
            <p className={reasonTouched && !reasonValid ? 'font-semibold text-rose-600' : 'text-slate-500'}>
              {reasonTouched && !reasonValid ? 'Please describe your reason (at least 5 characters).' : `${reason.length}/300 characters`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary px-4 py-2.5 text-xs" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Change slot
            </button>
            <button type="submit" className="btn-primary px-5 py-2.5 text-xs" disabled={!reasonValid}>
              Review booking <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 5 — Confirm */}
      {step === 4 && doctor && date && time && (
        <section className="card space-y-4 p-5" aria-label="Confirm appointment">
          <h3 className="font-bold text-slate-900">Confirm your appointment</h3>
          <dl className="divide-y divide-slate-100 rounded-xl bg-slate-50 text-sm ring-1 ring-slate-100">
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Doctor</dt><dd className="text-right font-semibold text-slate-900">{doctor.name} · {doctor.specialization}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Date</dt><dd className="font-semibold text-slate-900">{formatDate(date)}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Time</dt><dd className="font-semibold text-slate-900">{formatTime(time)}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Reason</dt><dd className="text-right font-semibold text-slate-900">{reason.trim()}</dd></div>
          </dl>
          {submitError && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {submitError} Please pick a different slot — this one may have just been taken.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary px-4 py-2.5 text-xs" onClick={() => setStep(3)} disabled={submitting}>
              <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Edit
            </button>
            <button className="btn-primary px-6 py-2.5 text-xs" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : <CalendarCheck2 className="mr-1 inline h-4 w-4" />}
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
          <p className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> The slot is re-verified server-side at the moment of booking (409 on conflict).
          </p>
        </section>
      )}

      {/* Bottom nav for steps 0–2 */}
      {step < 3 && (
        <div className="flex items-center justify-between">
          <button className="btn-secondary px-4 py-2.5 text-xs" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back
          </button>
          <Link to={PATHS.patient.doctors} className="text-xs font-semibold text-slate-500 hover:text-brand-700">Cancel booking</Link>
          <button className="btn-primary px-5 py-2.5 text-xs" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
