import { useState } from 'react';
import { Search, FilterX } from 'lucide-react';
import { doctorService } from '../../services/doctorService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import DoctorCard from '../../components/doctors/DoctorCard.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Stethoscope } from 'lucide-react';

const SPECIALIZATIONS = ['Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'General Medicine', 'Neurology', 'ENT', 'Ophthalmology'];
const DEPARTMENTS = ['Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'General Medicine', 'Neurology'];

export default function FindDoctorsPage() {
  const [q, setQ] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [department, setDepartment] = useState('');
  const [availableToday, setAvailableToday] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q);

  const params = { page, limit: 9 };
  if (debouncedQ) params.q = debouncedQ;
  if (specialization) params.specialization = specialization;
  if (department) params.department = department;
  if (availableToday) params.availableToday = 'true';

  const { data, loading, error } = useAsync(() => doctorService.list(params), [debouncedQ, specialization, department, availableToday, page]);

  function reset() {
    setQ(''); setSpecialization(''); setDepartment(''); setAvailableToday(false); setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Find a doctor</h2>
        <p className="mt-0.5 text-sm text-slate-500">Search specialists and check real-time availability.</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              placeholder="Search by doctor name…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input md:w-48" value={specialization} onChange={(e) => { setSpecialization(e.target.value); setPage(1); }}>
            <option value="">All specializations</option>
            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input md:w-44" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <button
            onClick={() => { setAvailableToday((v) => !v); setPage(1); }}
            className={`btn px-4 py-2.5 text-xs ring-1 ${availableToday ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'}`}
          >
            Available today
          </button>
        </div>
        {(q || specialization || department || availableToday) && (
          <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-700">
            <FilterX className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (data?.items || []).length === 0 ? (
        <EmptyState icon={Stethoscope} title="No doctors match your filters" description="Try clearing filters or searching a different name." />
      ) : (
        <>
          <p className="text-sm text-slate-500">{data.total} doctor{data.total !== 1 ? 's' : ''} found</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((d) => <DoctorCard key={d.id} doctor={d} />)}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} label="doctors" onChange={setPage} />
        </>
      )}
    </div>
  );
}
