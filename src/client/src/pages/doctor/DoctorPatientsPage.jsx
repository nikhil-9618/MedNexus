import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Search, ChevronRight, ShieldCheck } from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { ageFrom } from '../../utils/format.js';

export default function DoctorPatientsPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const { data, loading, error } = useAsync(() => doctorService.myPatients({ q: debounced, page, limit: 10 }), [debounced, page]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">My patients</h2>
        <p className="mt-0.5 text-sm text-slate-500">Only patients with an appointment or record relationship with you.</p>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search patient name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {loading ? <SkeletonTable rows={5} /> : (data?.items || []).length === 0 ? (
        <EmptyState icon={UserRound} title="No patients found" description="Patients appear once you have an appointment with them." />
      ) : (
        <>
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {data.items.map((p) => (
              <Link key={p.id} to={`/doctor/patients/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
                  {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name} <span className="font-mono text-xs text-slate-500">{p.patientId}</span></p>
                  <p className="text-xs text-slate-500">{p.gender || '—'} · {ageFrom(p.dob)} yrs · {p.appointments} appointment{p.appointments !== 1 ? 's' : ''}{p.lastVisit ? ` · last visit ${p.lastVisit}` : ''}</p>
                </div>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
                  <ShieldCheck className="h-3 w-3" /> Authorized
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} label="patients" onChange={setPage} />
        </>
      )}
    </div>
  );
}
