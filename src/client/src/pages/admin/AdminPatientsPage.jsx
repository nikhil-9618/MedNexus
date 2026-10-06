import { useState } from 'react';
import { Search, UserCheck, UserX, Users } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export default function AdminPatientsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null); // { patient, next }
  const [busy, setBusy] = useState(false);
  const debounced = useDebounce(q);

  const list = useAsync(() => adminService.patients({ q: debounced, page, limit: 10 }), [debounced, page]);

  async function confirm() {
    setBusy(true);
    try {
      await adminService.setPatientStatus(action.patient.id, action.next);
      toast.success(`Patient account ${action.next.toLowerCase()}`);
      setAction(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Patients</h2>
        <p className="mt-0.5 text-sm text-slate-500">Search accounts and manage access. All status changes are audited.</p>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search by name, email or patient ID…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {list.loading ? <SkeletonTable rows={6} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={Users} title="No patients found" description="Try a different search." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3 text-center">Appointments</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="font-mono text-xs text-slate-500">{p.patientId}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{p.email}<br /><span className="text-xs">{p.phone}</span></td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="font-bold text-slate-800">{p.appointmentStats?.total ?? 0}</span>
                      <span className="block text-[11px] text-slate-500">{p.appointmentStats?.upcoming ?? 0} upcoming</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ring-1 ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{p.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.status === 'ACTIVE' ? (
                        <button className="btn-secondary px-3 py-1.5 text-xs text-rose-600 ring-rose-200 hover:bg-rose-50"
                          disabled={p.email === user?.email}
                          onClick={() => setAction({ patient: p, next: 'SUSPENDED' })}>
                          <UserX className="h-3.5 w-3.5" /> Deactivate
                        </button>
                      ) : (
                        <button className="btn-secondary px-3 py-1.5 text-xs text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
                          onClick={() => setAction({ patient: p, next: 'ACTIVE' })}>
                          <UserCheck className="h-3.5 w-3.5" /> Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {list.data.items.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.patientId} · {p.email}</p>
                  </div>
                  <span className={`badge ring-1 ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{p.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{p.appointmentStats?.total ?? 0} appointments ({p.appointmentStats?.upcoming ?? 0} upcoming)</p>
                <div className="mt-3">
                  {p.status === 'ACTIVE' ? (
                    <button className="btn-secondary w-full px-3 py-2 text-xs text-rose-600 ring-rose-200"
                      disabled={p.email === user?.email}
                      onClick={() => setAction({ patient: p, next: 'SUSPENDED' })}>
                      <UserX className="h-3.5 w-3.5" /> Deactivate account
                    </button>
                  ) : (
                    <button className="btn-secondary w-full px-3 py-2 text-xs text-emerald-700 ring-emerald-200"
                      onClick={() => setAction({ patient: p, next: 'ACTIVE' })}>
                      <UserCheck className="h-3.5 w-3.5" /> Activate account
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="patients" onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={confirm}
        title={action?.next === 'SUSPENDED' ? 'Deactivate this patient account?' : 'Activate this patient account?'}
        message={action?.next === 'SUSPENDED'
          ? `${action?.patient?.name} (${action?.patient?.patientId}) will immediately lose login and API access. Existing data is preserved.`
          : `${action?.patient?.name} (${action?.patient?.patientId}) will regain login and API access.`}
        confirmLabel={action?.next === 'SUSPENDED' ? 'Deactivate' : 'Activate'}
        danger={action?.next === 'SUSPENDED'}
        busy={busy}
      />
    </div>
  );
}
