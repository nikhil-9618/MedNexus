import { useState } from 'react';
import { CalendarClock, CheckCircle2, Hourglass, CalendarX2, UserRound } from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonStats, SkeletonTable } from '../../components/common/Skeleton.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

export default function DoctorDashboardPage() {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const dash = useAsync(() => doctorService.myDashboard(), []);
  const appts = useAsync(() => appointmentService.list({ date: undefined, limit: 100 }), []);
  const stats = dash.data?.stats;

  const today = new Date();
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todays = (appts.data?.items || []).filter((a) => a.date === todayStr && a.status !== 'Cancelled');

  async function setStatus(a, status) {
    setBusyId(a.id);
    try {
      await appointmentService.update(a.id, { status });
      toast.success(`Appointment ${status.toLowerCase()}`);
      appts.refetch();
      dash.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {dash.data?.doctor?.name?.replace('Dr. ', '') || 'Doctor'}</h2>
        <p className="mt-0.5 text-sm text-slate-500">Here's your clinic day at a glance.</p>
      </div>

      {dash.loading ? <SkeletonStats /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CalendarClock} label="Today's appointments" value={stats?.todayTotal ?? '—'} tone="brand" />
          <StatCard icon={CheckCircle2} label="Completed today" value={stats?.todayCompleted ?? '—'} tone="emerald" />
          <StatCard icon={Hourglass} label="Waiting (unconfirmed)" value={stats?.waiting ?? '—'} tone="amber" />
          <StatCard icon={CalendarX2} label="Cancelled today" value={stats?.todayCancelled ?? '—'} tone="rose" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionHeading title="Today's schedule" subtitle={formatDate(todayStr)} />
          {appts.loading ? <SkeletonTable rows={4} /> : todays.length === 0 ? (
            <EmptyState icon={UserRound} title="No appointments today" description="Your schedule is clear." />
          ) : (
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {todays.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="w-20 shrink-0">
                    <p className="font-bold text-slate-900">{formatTime(a.time)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.patient?.name} <span className="font-mono text-xs text-slate-500">{a.patient?.patientId}</span></p>
                    <p className="truncate text-xs text-slate-500">{a.reason}</p>
                  </div>
                  <StatusBadge status={a.status} />
                  <div className="flex gap-1.5">
                    {a.status === 'Scheduled' && (
                      <button className="btn-secondary px-2.5 py-1.5 text-[11px]" disabled={busyId === a.id} onClick={() => setStatus(a, 'Confirmed')}>Confirm</button>
                    )}
                    {['Scheduled', 'Confirmed'].includes(a.status) && (
                      <button className="btn-primary px-2.5 py-1.5 text-[11px]" disabled={busyId === a.id} onClick={() => setStatus(a, 'Completed')}>Complete</button>
                    )}
                    <button className="btn-ghost px-2 py-1.5 text-[11px]" onClick={() => setSelected(a)}>Details</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">All-time</p>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-600">
              <li className="flex justify-between"><span>Upcoming appointments</span><span className="font-bold">{stats?.upcoming ?? '—'}</span></li>
              <li className="flex justify-between"><span>Completed consultations</span><span className="font-bold">{stats?.completedTotal ?? '—'}</span></li>
              <li className="flex justify-between"><span>Unique patients seen</span><span className="font-bold">{stats?.patientsSeen ?? '—'}</span></li>
            </ul>
          </div>
        </div>
      </div>

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
