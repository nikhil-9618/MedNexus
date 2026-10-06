import { useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { formatDateTime } from '../../utils/format.js';

const RESULTS = ['SUCCESS', 'DENIED', 'FAILED'];

export default function AdminAuditLogsPage() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);

  const params = { page, limit: 15 };
  if (debounced) params.q = debounced;
  if (action) params.action = action;
  if (result) params.result = result;
  const { data, loading, error } = useAsync(() => adminService.auditLogs(params), [debounced, action, result, page]);

  const resultClass = (r) =>
    r === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : r === 'DENIED' ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Audit logs</h2>
        <p className="mt-0.5 text-sm text-slate-500">Every security-relevant event — logins, record access, bookings and admin actions.</p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search action, detail or resource…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <input className="input" placeholder="Action e.g. LOGIN" value={action} onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(1); }} />
        <select className="input" value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }}>
          <option value="">All results</option>
          {RESULTS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {loading ? <SkeletonTable rows={8} /> : (data?.items || []).length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries match" description="Try clearing the filters." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(a.timestamp)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-700">{a.user}</p>
                      <p className="truncate text-xs text-slate-500">{a.ipAddress || '—'}</p>
                    </td>
                    <td className="px-5 py-3"><span className="badge bg-slate-100 text-slate-600 ring-1 ring-slate-200">{a.role}</span></td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs font-bold text-slate-700">{a.action}</p>
                      {a.detail && <p className="max-w-[260px] truncate text-xs text-slate-500">{a.detail}</p>}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {a.resourceType}
                      {a.resourceId && <span className="block font-mono text-slate-500">{String(a.resourceId).slice(0, 18)}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ring-1 ${resultClass(a.result)}`}>{a.result}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} label="entries" onChange={setPage} />
        </>
      )}
    </div>
  );
}
