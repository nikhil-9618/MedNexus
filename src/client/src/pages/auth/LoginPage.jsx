import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { apiError } from '../../services/api.js';
import { homeForRole, PATHS } from '../../routes/paths.js';
import { Loader } from '../../components/common/Loader.jsx';
import { KeyRound, Mail, UserRound } from 'lucide-react';

const ROLES = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'ADMIN', label: 'Admin' },
];

const DEMO = [
  { role: 'PATIENT', email: 'patient@mednexus.demo', password: 'Patient@MedNexus2026' },
  { role: 'DOCTOR', email: 'doctor@mednexus.demo', password: 'Doctor@MedNexus2026' },
  { role: 'ADMIN', email: 'admin@mednexus.demo', password: 'Admin@MedNexus2026' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '', role: 'PATIENT', remember: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    if (k === 'remember') setForm((f) => ({ ...f, remember: e.target.checked }));
    else setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  function validate() {
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const user = await login(form.email.trim(), form.password, form.role);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      const dest = location.state?.from || homeForRole(user.role);
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(acc) {
    setForm((f) => ({ ...f, email: acc.email, password: acc.password, role: acc.role }));
    setErrors({});
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Welcome Back</h1>
        <p className="mt-1.5 text-sm text-slate-500">Login to your account.</p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        {/* Role selector */}
        <div>
          <span className="label">Login as</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  form.role === r.value
                    ? 'bg-white text-brand-700 shadow-card ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              className={`input pl-9 ${errors.email ? 'ring-rose-400' : ''}`}
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={`input pl-9 ${errors.password ? 'ring-rose-400' : ''}`}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
            />
          </div>
          {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={set('remember')}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => toast.info('Password reset is managed by your clinic administrator in this demo.')}
            className="font-semibold text-brand-700 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Loader label="Logging in…" /> : 'Login'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to={PATHS.register} className="font-semibold text-brand-700 hover:underline">
          Register
        </Link>
      </p>

      <div className="mt-7 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <UserRound className="h-3.5 w-3.5" /> Demo accounts — synthetic data
        </p>
        <div className="mt-2.5 space-y-1.5">
          {DEMO.map((acc) => (
            <button
              key={acc.role}
              onClick={() => fillDemo(acc)}
              className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs ring-1 ring-slate-200 transition-colors hover:ring-brand-300"
            >
              <span>
                <span className="font-bold text-slate-700">{acc.role.charAt(0) + acc.role.slice(1).toLowerCase()}</span>
                <span className="text-slate-500"> · {acc.email}</span>
              </span>
              <span className="font-semibold text-brand-600">Use →</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          Demo passwords: Patient@MedNexus2026 · Doctor@MedNexus2026 · Admin@MedNexus2026 — local development only.
        </p>
      </div>
    </div>
  );
}
