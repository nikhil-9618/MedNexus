import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../services/api.js';
import RecordCard from '../../components/records/RecordCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export default function DoctorRecordsPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => api.get('/appointments', { params: { status: 'Completed', page, limit: 50 } }), [page]);

  // Records authored by this doctor = completed appointments with linked records.
  // The records endpoint is patient-scoped, so derive from completed appointments.
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Records</h2>
        <p className="mt-0.5 text-sm text-slate-500">Clinical documentation for your completed consultations.</p>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {loading ? <SkeletonTable rows={4} /> : items.length === 0 ? (
        <EmptyState icon={FileText} title="No completed consultations yet" description="Complete a consultation from your dashboard to create records." />
      ) : (
        <>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {items.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.patient?.name} <span className="font-mono text-xs text-slate-500">{a.patient?.patientId}</span></p>
                  <p className="truncate text-xs text-slate-500">{a.date} · {a.reason}</p>
                </div>
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Completed</span>
                <a className="btn-secondary px-3 py-1.5 text-xs" href={`/doctor/patients/${a.patient?.id}`}>View patient</a>
              </div>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} label="consultations" onChange={setPage} />
        </>
      )}
    </div>
  );
}
