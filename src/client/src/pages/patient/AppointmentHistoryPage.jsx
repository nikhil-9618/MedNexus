import { useState } from 'react';
import { History } from 'lucide-react';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import AppointmentCard from '../../components/appointments/AppointmentCard.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export default function AppointmentHistoryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('Completed');
  const [selected, setSelected] = useState(null);
  const list = useAsync(() => appointmentService.list({ page, limit: 8, status }), [page, status]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Appointment history</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your past and cancelled visits.</p>
      </div>

      <div className="flex gap-2">
        {['Completed', 'Cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-all ${
              status === s ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {list.loading ? <SkeletonTable rows={4} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={History} title={`No ${status.toLowerCase()} appointments`} description="History builds up after consultations." />
      ) : (
        <>
          <div className="space-y-3">
            {list.data.items.map((a) => <AppointmentCard key={a.id} appointment={a} role="PATIENT" onView={setSelected} />)}
          </div>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="appointments" onChange={setPage} />
        </>
      )}

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
