import { useAsync } from '../../hooks/useAsync.js';
import { doctorService } from '../../services/doctorService.js';
import { authService } from '../../services/authService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useState } from 'react';
import { Loader } from '../../components/common/Loader.jsx';
import { WEEKDAYS } from '../../utils/constants.js';
import { formatTime } from '../../utils/format.js';
import { KeyRound, ShieldCheck, Star, Award, MapPin } from 'lucide-react';

export default function DoctorProfilePage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading } = useAsync(() => doctorService.myDashboard(), []);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);

  if (loading) return <Loader fullScreen label="Loading profile…" />;
  const doctor = data?.doctor;

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirmPassword) { toast.error('New passwords do not match'); return; }
    setBusy(true);
    try {
      await authService.changePassword(pwd);
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Clinic-assigned profile — availability is configured by administrators.</p>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 font-display text-xl font-bold text-white">
            {(doctor?.name || user?.name || '').replace('Dr. ', '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">{doctor?.name || user?.name}</h3>
            <p className="text-sm text-brand-700">{doctor?.specialization} · {doctor?.department}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(doctor?.rating || 0).toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              <Award className="h-3.5 w-3.5" /> {doctor?.experience} yrs
            </span>
          </div>
        </div>
        {doctor?.clinicInformation && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 text-slate-500" /> {doctor.clinicInformation.name} — {doctor.clinicInformation.address}
          </p>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-slate-900">Weekly availability</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {WEEKDAYS.map((day) => {
            const slots = doctor?.availability?.[day] || [];
            return (
              <div key={day} className="rounded-xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-500">{day}</p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {slots.length === 0 ? 'Not available' : slots.map((t) => formatTime(t)).join(', ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><KeyRound className="h-4 w-4 text-brand-600" /> Change password</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <input type="password" className="input" placeholder="Current password" autoComplete="current-password"
            value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} required />
          <input type="password" className="input" placeholder="New password" autoComplete="new-password"
            value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} required />
          <input type="password" className="input" placeholder="Confirm new password" autoComplete="new-password"
            value={pwd.confirmPassword} onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))} required />
        </div>
        <button className="btn-secondary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Password changes are audited.</p>
      </form>
    </div>
  );
}
