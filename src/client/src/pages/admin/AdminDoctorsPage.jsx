import { useState } from 'react';
import { Search, UserPlus, Pencil, UserCheck, UserX, Stethoscope } from 'lucide-react';
import Modal from '../../components/common/Modal.jsx';
import { adminService } from '../../services/adminService.js';
import { doctorService } from '../../services/doctorService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { SPECIALIZATIONS, WEEKDAYS, SLOTS } from '../../utils/constants.js';

const EMPTY_FORM = {
  name: '', email: '', password: '', specialization: 'Cardiology', department: 'Cardiology',
  experience: 5, qualification: '', bio: '', consultationFee: 60,
  availability: { Mon: ['09:00', '09:30', '10:00'], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
};

export default function AdminDoctorsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const list = useAsync(() => adminService.doctors({ q: debounced, page, limit: 10 }), [debounced, page]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // doctor row
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [statusAction, setStatusAction] = useState(null);

  function openAdd() { setForm(EMPTY_FORM); setAdding(true); }
  async function openEdit(d) {
    // Fetch full profile (incl. availability Map) from the public doctor endpoint.
    try {
      const res = await doctorService.get(d.id);
      const full = res.data.doctor;
      setForm({
        name: full.name, email: full.email, password: '',
        specialization: full.specialization, department: full.department,
        experience: full.experience, qualification: full.qualification || '', bio: full.bio || '',
        consultationFee: full.consultationFee || 0,
        availability: availabilityOf(full),
      });
    } catch {
      setForm({ ...EMPTY_FORM, name: d.name, specialization: d.specialization, department: d.department, experience: d.experience });
    }
    setEditing(d);
  }

  function availabilityOf(d) {
    // Edit modal fetches fresh doctor data via update endpoint; seed shape comes through the list.
    const av = {};
    WEEKDAYS.forEach((w) => { av[w] = (d.availability && d.availability[w]) || []; });
    return av;
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function toggleSlot(day, slot) {
    setForm((f) => {
      const cur = f.availability[day] || [];
      const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot].sort();
      return { ...f, availability: { ...f.availability, [day]: next } };
    });
  }

  async function saveDoctor(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { name, specialization, department, experience, qualification, bio, consultationFee, availability } = form;
        await adminService.updateDoctor(editing.id, { name, specialization, department, experience: Number(experience), qualification, bio, consultationFee: Number(consultationFee), availability });
        toast.success('Doctor updated');
      } else {
        await adminService.createDoctor({ ...form, experience: Number(form.experience), consultationFee: Number(form.consultationFee) });
        toast.success('Doctor created');
      }
      setAdding(false); setEditing(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmStatus() {
    setBusy(true);
    try {
      await adminService.setDoctorStatus(statusAction.doctor.id, statusAction.next);
      toast.success(`Doctor account ${statusAction.next.toLowerCase()}`);
      setStatusAction(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const doctorForm = (
    <form onSubmit={saveDoctor} className="space-y-4" id="doctor-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Full name</label><input className="input" value={form.name} onChange={setF('name')} required placeholder="Dr. Jane Citizen" /></div>
        {!editing && <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={setF('email')} required /></div>}
        {!editing && <div><label className="label">Temp password</label><input className="input" value={form.password} onChange={setF('password')} required minLength={8} placeholder="Min 8 chars" /></div>}
        <div><label className="label">Specialization</label>
          <select className="input" value={form.specialization} onChange={setF('specialization')}>
            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label">Department</label>
          <select className="input" value={form.department} onChange={setF('department')}>
            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label">Experience (years)</label><input type="number" min="0" max="60" className="input" value={form.experience} onChange={setF('experience')} /></div>
        <div><label className="label">Consultation fee ($)</label><input type="number" min="0" className="input" value={form.consultationFee} onChange={setF('consultationFee')} /></div>
        <div className="sm:col-span-2"><label className="label">Qualification</label><input className="input" value={form.qualification} onChange={setF('qualification')} placeholder="MD, DM…" /></div>
        <div className="sm:col-span-2"><label className="label">Bio (shown on profile)</label><textarea rows={2} className="input resize-none" value={form.bio} onChange={setF('bio')} /></div>
      </div>

      <div>
        <p className="label">Weekly availability (click slots to toggle)</p>
        <div className="space-y-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
              <span className="w-10 text-xs font-bold text-slate-500">{day}</span>
              {SLOTS.map((slot) => {
                const on = (form.availability[day] || []).includes(slot);
                return (
                  <button type="button" key={slot} onClick={() => toggleSlot(day, slot)}
                    className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ring-1 ${on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-500 ring-slate-200'}`}>
                    {slot}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Doctors</h2>
          <p className="mt-0.5 text-sm text-slate-500">Add doctors, edit profiles and configure availability.</p>
        </div>
        <button className="btn-primary" onClick={openAdd}><UserPlus className="h-4 w-4" /> Add doctor</button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search doctors…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {list.loading ? <SkeletonTable rows={5} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={Stethoscope} title="No doctors found" description="Add your first doctor to get started." />
      ) : (
        <>
          <div className="card hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Specialization</th>
                  <th className="px-5 py-3 text-center">Experience</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{d.name}</p>
                      <p className="font-mono text-xs text-slate-500">{d.doctorId} · {d.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{d.specialization}<br /><span className="text-xs text-slate-500">{d.department}</span></td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-800">{d.experience} yrs</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ring-1 ${d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{d.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                        {d.status === 'ACTIVE' ? (
                          <button className="btn-secondary px-2.5 py-1.5 text-xs text-rose-600 ring-rose-200" onClick={() => setStatusAction({ doctor: d, next: 'SUSPENDED' })}>
                            <UserX className="h-3.5 w-3.5" /> Deactivate
                          </button>
                        ) : (
                          <button className="btn-secondary px-2.5 py-1.5 text-xs text-emerald-700 ring-emerald-200" onClick={() => setStatusAction({ doctor: d, next: 'ACTIVE' })}>
                            <UserCheck className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {list.data.items.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.doctorId} · {d.specialization}</p>
                  </div>
                  <span className={`badge ring-1 ${d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{d.status}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary flex-1 px-3 py-2 text-xs" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  {d.status === 'ACTIVE' ? (
                    <button className="btn-secondary flex-1 px-3 py-2 text-xs text-rose-600 ring-rose-200" onClick={() => setStatusAction({ doctor: d, next: 'SUSPENDED' })}>Deactivate</button>
                  ) : (
                    <button className="btn-secondary flex-1 px-3 py-2 text-xs text-emerald-700 ring-emerald-200" onClick={() => setStatusAction({ doctor: d, next: 'ACTIVE' })}>Activate</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="doctors" onChange={setPage} />
        </>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={adding || !!editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'Add doctor'}
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAdding(false); setEditing(null); }} disabled={busy}>Cancel</button>
            <button type="submit" form="doctor-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create doctor'}</button>
          </>
        }
      >
        {doctorForm}
      </Modal>

      <ConfirmDialog
        open={!!statusAction}
        onClose={() => setStatusAction(null)}
        onConfirm={confirmStatus}
        title={statusAction?.next === 'SUSPENDED' ? 'Deactivate this doctor?' : 'Activate this doctor?'}
        message={statusAction?.next === 'SUSPENDED'
          ? `${statusAction?.doctor?.name} will be hidden from the directory and cannot take bookings.`
          : `${statusAction?.doctor?.name} will reappear in the directory and accept bookings.`}
        confirmLabel={statusAction?.next === 'SUSPENDED' ? 'Deactivate' : 'Activate'}
        danger={statusAction?.next === 'SUSPENDED'}
        busy={busy}
      />
    </div>
  );
}
