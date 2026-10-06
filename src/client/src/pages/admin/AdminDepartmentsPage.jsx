import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

const EMPTY = { code: '', name: '', description: '' };

export default function AdminDepartmentsPage() {
  const toast = useToast();
  const list = useAsync(() => adminService.departments(), []);
  const [form, setForm] = useState(EMPTY);
  const [editingCode, setEditingCode] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingCode) {
        await adminService.updateDepartment(editingCode, { name: form.name, description: form.description });
        toast.success('Department updated');
      } else {
        await adminService.createDepartment(form);
        toast.success('Department created');
      }
      setOpen(false);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await adminService.deleteDepartment(deleting.code);
      toast.success('Department deleted');
      setDeleting(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Departments</h2>
          <p className="mt-0.5 text-sm text-slate-500">Clinic departments used for doctor assignment and filtering.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditingCode(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add department
        </button>
      </div>

      {list.loading ? <SkeletonTable rows={5} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={Building2} title="No departments" description="Create the first department." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.items.map((d) => (
            <div key={d.code} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 font-mono text-xs font-bold text-brand-700">
                  {d.code}
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost px-2 py-1.5" onClick={() => { setForm({ code: d.code, name: d.name, description: d.description || '' }); setEditingCode(d.code); setOpen(true); }} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="btn-ghost px-2 py-1.5 text-rose-600" onClick={() => setDeleting(d)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 font-semibold text-slate-800">{d.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">{d.description || 'No description'}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingCode ? `Edit ${editingCode}` : 'Add department'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" form="dept-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form id="dept-form" onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Code</label>
            <input className="input font-mono uppercase" value={form.code} maxLength={12}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              disabled={!!editingCode} required placeholder="CARD" />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Cardiology" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="input resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this department?"
        message={`${deleting?.name} (${deleting?.code}) will be removed. Deletion is blocked if doctors are still assigned to it.`}
        confirmLabel="Delete department"
        busy={busy}
      />
    </div>
  );
}
