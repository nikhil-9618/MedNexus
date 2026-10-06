import { useState } from 'react';
import { Search, CalendarClock } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import { STATUS_FLOW } from '../../utils/constants.js';
import { formatDate, formatTime } from '../../utils/format.js';

const VALID = {
  Scheduled: ['Confirmed', 'Completed', 'Cancelled'],
  Confirmed: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

export default function AdminAppointmentsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const debounced = useDebounce(q);

  const params = { page, limit: 10 };
  if (debounced) params.q = debounced;
  if (status) params.status = status;
  if (date) params.date = date;
  const list = useAsync(() => adminService.appointments(params), [debounced, status, date, page]);

  async function changeStatus(a, next) {
    try {
      await adminService.setAppointmentStatus(a.id, next);
      toast.success(`Appointment ${next.toLowerCase()}`);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Transition rejected');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Appointments</h2>
        <p className="mt-0.5 text-sm text-slate-500">All bookings with lifecycle enforcement — invalid transitions are rejected by the server.</p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search patient, doctor, reason…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUS_FLOW.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
      </div>

      {list.loading ? <SkeletonTable rows={6} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={CalendarClock} title="No appointments match" description="Adjust the filters to see more results." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{formatDate(a.date)}</p>
                      <p className="text-xs text-slate-500">{formatTime(a.time)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-700">{a.patient?.name}</p>
                      <p className="font-mono text-xs text-slate-500">{a.patient?.patientId}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-700">{a.doctor?.name}</p>
                      <p className="text-xs text-slate-500">{a.doctor?.specialization}</p>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {(VALID[a.status] || []).map((next) => (
                          <button key={next}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg ring-1 ${
                              next === 'Cancelled' ? 'bg-white text-rose-600 ring-rose-200 hover:bg-rose-50' : 'bg-white text-brand-700 ring-brand-200 hover:bg-brand-50'
                            }`}
                            onClick={() => changeStatus(a, next)}>
                            {next}
                          </button>
                        ))}
                        <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setSelected(a)}>Details</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="appointments" onChange={setPage} />
        </>
      )}

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
