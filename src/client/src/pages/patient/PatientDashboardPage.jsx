import { Link } from 'react-router-dom';
import { CalendarClock, FileText, CalendarCheck2, Users, CalendarPlus } from 'lucide-react';
import { api } from '../../services/api.js';
import { appointmentService } from '../../services/appointmentService.js';
import { recordService } from '../../services/recordService.js';
import { useAsync } from '../../hooks/useAsync.js';
import StatCard from '../../components/common/StatCard.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import AppointmentCard from '../../components/appointments/AppointmentCard.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import { SkeletonStats, SkeletonTable } from '../../components/common/Skeleton.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useState } from 'react';
import { PATHS } from '../../routes/paths.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const stats = useAsync(() => api.get('/patients/me/dashboard'), []);
  const upcoming = useAsync(() => appointmentService.list({ limit: 5, from: new Date().toISOString().slice(0, 10) }), []);
  const records = useAsync(() => recordService.mine({ limit: 3 }), []);

  const s = stats.data?.stats;
  const items = upcoming.data?.items?.filter((a) => a.status !== 'Cancelled') || [];
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Greeting — matches reference */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            {greeting()}, {firstName}!
          </h2>
          <p className="mt-1 text-sm text-slate-500">Take care of your health, one step at a time.</p>
        </div>
        <Link to={PATHS.patient.bookWizard} className="btn-primary">
          <CalendarPlus className="h-4 w-4" /> Book appointment
        </Link>
      </div>

      {/* Metric cards — reference layout */}
      {stats.loading ? <SkeletonStats /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CalendarClock} label="Upcoming Appointments" value={s?.upcoming ?? '—'} tone="brand" />
          <StatCard icon={CalendarCheck2} label="Total Appointments" value={s?.total ?? '—'} tone="sky" />
          <StatCard icon={FileText} label="Medical Records" value={s?.records ?? '—'} tone="violet" />
          <StatCard icon={Users} label="Doctors Visited" value={s?.doctorsVisited ?? '—'} tone="emerald" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <SectionHeading title="Upcoming Appointment" subtitle="Your next visit" />
              <Link to={PATHS.patient.appointments} className="text-xs font-bold text-brand-700 hover:underline">
                View All
              </Link>
            </div>
            {upcoming.loading ? <SkeletonTable rows={3} /> : items.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming appointments"
                description="Browse the doctor directory and book your first visit."
                action={<Link to={PATHS.patient.doctors} className="btn-primary px-4 py-2 text-xs">Find a doctor</Link>}
              />
            ) : (
              <div className="space-y-3">
                {items.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} role="PATIENT" onView={setSelected} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-900">Recent medical records</p>
            {records.loading ? (
              <div className="mt-3 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              </div>
            ) : (records.data?.items || []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No records yet — they appear after consultations.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {records.data.items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-600">{r.diagnosis}</span>
                    <span className="shrink-0 text-xs text-slate-500">{r.date}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={PATHS.patient.records} className="mt-4 inline-block text-xs font-bold text-brand-700 hover:underline">
              View all records →
            </Link>
          </div>
        </div>
      </div>

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
