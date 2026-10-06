import { useEffect, useState } from 'react';
import { api, apiError } from '../../services/api.js';
import { authService } from '../../services/authService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { Lock, KeyRound, ShieldCheck } from 'lucide-react';

const GENDERS = ['Female', 'Male', 'Other'];

export default function PatientProfilePage() {
  const toast = useToast();
  const { setUser } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(null);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/patients/me')
      .then((res) => {
        setMe(res.data);
        setForm({
          name: res.data.user.name,
          phone: res.data.patient.phone || '',
          dob: res.data.patient.dob || '',
          gender: res.data.patient.gender || '',
          address: res.data.patient.address || '',
          bloodGroup: res.data.patient.bloodGroup || '',
        });
      })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put('/patients/me', form);
      setMe(res.data);
      setUser(res.data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setPwdBusy(true);
    try {
      await authService.changePassword(pwd);
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setPwdBusy(false);
    }
  }

  if (loading) return <Loader fullScreen label="Loading profile…" />;
  if (!me) return <p className="text-slate-500">Profile unavailable.</p>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Patient ID <span className="font-mono font-semibold text-slate-700">{me.patient.patientId}</span> · role and privileges are fixed.</p>
      </div>

      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <h3 className="font-bold text-slate-900">Personal details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-name">Full name</label>
            <input id="p-name" className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label" htmlFor="p-phone">Phone</label>
            <input id="p-phone" className="input" value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="label" htmlFor="p-dob">Date of birth</label>
            <input id="p-dob" type="date" className="input" value={form.dob} onChange={set('dob')} />
          </div>
          <div>
            <label className="label" htmlFor="p-gender">Gender</label>
            <select id="p-gender" className="input" value={form.gender} onChange={set('gender')}>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-address">Address</label>
            <input id="p-address" className="input" value={form.address || ''} onChange={set('address')} placeholder="Optional" />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500 ring-1 ring-slate-100">
          <p className="flex items-center gap-1.5 font-semibold text-slate-600"><Lock className="h-3.5 w-3.5" /> Immutable fields</p>
          <p className="mt-1">Email: <span className="font-semibold">{me.user.email}</span> · Role: <span className="font-semibold">{me.user.role}</span> · Patient ID: <span className="font-mono">{me.patient.patientId}</span> — contact the clinic to change these.</p>
        </div>

        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

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
        <button className="btn-secondary" disabled={pwdBusy}>{pwdBusy ? 'Updating…' : 'Update password'}</button>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Password changes are audited.</p>
      </form>
    </div>
  );
}
