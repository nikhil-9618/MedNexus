import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { apiError } from '../../services/api.js';
import { homeForRole, PATHS } from '../../routes/paths.js';
import { Loader } from '../../components/common/Loader.jsx';
import { KeyRound, Mail } from 'lucide-react';

const ROLES = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function LoginPage() {
  const { login, booting } = useAuth();
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
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        const email = form.email.trim().toLowerCase();
        toast.info('Confirm your account using the link in your email.');
        setBusy(false);
        navigate(PATHS.verifyEmail, { state: { email } });
        return;
      }
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
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

        <button type="submit" className="btn-primary w-full py-3" disabled={busy || booting}>
          {busy ? <Loader label="Logging in…" /> : 'Login'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to={PATHS.register} className="font-semibold text-brand-700 hover:underline">
          Register
        </Link>
      </p>

      <p className="mt-7 text-center text-xs leading-5 text-slate-500">
        Patient accounts are created by signing up and verifying your email.
        Doctor and administrator accounts are provisioned by your clinic.
      </p>
    </div>
  );
}
