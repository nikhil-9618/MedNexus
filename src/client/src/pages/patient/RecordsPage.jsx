import { useState } from 'react';
import { FileLock2, FileText } from 'lucide-react';
import { recordService } from '../../services/recordService.js';
import { useAsync } from '../../hooks/useAsync.js';
import RecordCard from '../../components/records/RecordCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import SyntheticDataNotice from '../../components/common/SyntheticDataNotice.jsx';

export default function RecordsPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => recordService.mine({ page, limit: 8 }), [page]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Medical records</h2>
        <p className="mt-0.5 text-sm text-slate-500">Records are authored by your doctors and read-only for patients.</p>
      </div>
      <SyntheticDataNotice />

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
      {loading ? <SkeletonTable rows={4} /> : (data?.items || []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No medical records yet"
          description="After a consultation, your doctor's notes will appear here."
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((r) => <RecordCard key={r.id} record={r} />)}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} label="records" onChange={setPage} />
        </>
      )}
    </div>
  );
}
