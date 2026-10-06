import { Star, CalendarClock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths.js';

export default function DoctorCard({ doctor, onBook }) {
  const d = doctor;
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
          {d.name.replace('Dr. ', '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{d.name}</p>
          <p className="text-sm text-brand-700">{d.specialization}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(d.rating || 0).toFixed(1)}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-slate-500">
        <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-slate-500" /> {d.experience} yrs experience · {d.department}</p>
        <p className="flex items-center gap-2 truncate"><MapPin className="h-4 w-4 text-slate-500" /> {d.clinicInformation?.name || 'MedNexus Clinic'}</p>
      </div>

      <div className="mt-5 flex gap-2.5">
        <Link to={`${PATHS.patient.doctors}/${d.id}`} className="btn-secondary flex-1 px-3 py-2 text-xs">View profile</Link>
        {onBook ? (
          <button className="btn-primary flex-1 px-3 py-2 text-xs" onClick={() => onBook(d)}>Book appointment</button>
        ) : (
          <Link to={`${PATHS.patient.doctors}/${d.id}`} className="btn-primary flex-1 px-3 py-2 text-xs">Book appointment</Link>
        )}
      </div>
    </div>
  );
}
