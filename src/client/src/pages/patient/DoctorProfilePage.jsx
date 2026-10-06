import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Star, CalendarClock, MapPin, Award, BadgeCheck, ArrowLeft } from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { useAsync } from '../../hooks/useAsync.js';
import SlotPicker, { nextDays } from '../../components/doctors/SlotPicker.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { PATHS } from '../../routes/paths.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatTime } from '../../utils/format.js';

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => doctorService.get(id), [id]);
  const [date, setDate] = useState(nextDays(1)[0]);
  const [time, setTime] = useState('');
  const today = nextDays(1)[0];

  if (loading) return <Loader fullScreen label="Loading doctor profile…" />;
  if (error || !data?.doctor) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600">Doctor not found.</p>
        <Link to={PATHS.patient.doctors} className="btn-primary mt-4">Back to directory</Link>
      </div>
    );
  }

  const d = data.doctor;

  return (
    <div className="space-y-6">
      <Link to={PATHS.patient.doctors} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to directory
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 font-display text-2xl font-bold text-white">
            {d.name.replace('Dr. ', '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-slate-900">{d.name}</h2>
            <p className="mt-0.5 text-brand-700 font-semibold">{d.specialization} · {d.department}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700 ring-1 ring-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(d.rating || 0).toFixed(1)} ({d.reviewsCount} reviews)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                <Award className="h-3.5 w-3.5 text-slate-500" /> {d.experience} years
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <BadgeCheck className="h-3.5 w-3.5" /> {d.isAcceptingNew ? 'Accepting new patients' : 'Not accepting new patients'}
              </span>
            </div>
          </div>
        </div>

        {d.bio && <p className="mt-5 text-sm leading-6 text-slate-600">{d.bio}</p>}

        <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-100 sm:grid-cols-2">
          <p className="flex items-center gap-2 text-slate-600"><MapPin className="h-4 w-4 text-slate-500" /> {d.clinicInformation?.name} — {d.clinicInformation?.address}</p>
          <p className="flex items-center gap-2 text-slate-600"><CalendarClock className="h-4 w-4 text-slate-500" /> Consultation fee: ${d.consultationFee}</p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-slate-900">Availability</h3>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">Pick a date, then choose a free slot.</p>
        <SlotPicker doctorId={d.id} date={date} onDateChange={(v) => { setTime(''); setDate(v); }} onSlotPick={setTime} selectedTime={time} />
        <div className="mt-6 flex justify-end">
          <button
            className="btn-primary px-6 py-3"
            disabled={!time}
            onClick={() => navigate(`${PATHS.patient.doctors}/${d.id}/book`, { state: { date, time } })}
          >
            {time ? `Continue with ${formatTime(time)}` : 'Select a slot to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
