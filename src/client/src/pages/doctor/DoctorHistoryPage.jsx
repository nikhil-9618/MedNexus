import { useState } from 'react';
import { History } from 'lucide-react';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import AppointmentCard from '../../components/appointments/AppointmentCard.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export default function DoctorHistoryPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const list = useAsync(() => appointmentService.list({ page, limit: 8, status: 'Completed' }), [page]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">History</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your completed consultations.</p>
      </div>

      {list.loading ? <SkeletonTable rows={4} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={History} title="No completed consultations yet" description="History builds up as you complete appointments." />
      ) : (
        <>
          <div className="space-y-3">
            {list.data.items.map((a) => <AppointmentCard key={a.id} appointment={a} role="DOCTOR" onView={setSelected} />)}
          </div>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="appointments" onChange={setPage} />
        </>
      )}

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
