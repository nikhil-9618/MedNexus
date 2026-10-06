import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { apiError, apiFieldErrors } from '../../services/api.js';
import { PATHS, homeForRole } from '../../routes/paths.js';
import { Loader } from '../../components/common/Loader.jsx';

const GENDERS = ['Female', 'Male', 'Other'];

export default function RegisterPage() {
  const { register, user, booting } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    name: '', email: location.state?.email || '', phone: '', dob: '', gender: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const prefillEmail = (location.state && location.state.email) || '';
  const [step, setStep] = useState(location.pathname === PATHS.verifyEmail ? 'confirmation' : 'form');
  const [pendingEmail, setPendingEmail] = useState(prefillEmail);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errs.email = 'Enter a valid email';
    if (!/^[+]?[\d\s()-]{7,20}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number';
    if (!form.dob) errs.dob = 'Select your date of birth';
    else if (new Date(form.dob) > new Date()) errs.dob = 'Date of birth cannot be in the future';
    if (!GENDERS.includes(form.gender)) errs.gender = 'Select a gender';
    if (form.password.length < 8 || form.password.length > 72 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = '8–72 characters with upper, lower and a number';
    }
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        dob: form.dob,
        gender: form.gender,
        password: form.password,
        confirmPassword: form.confirmPassword,
        website: honeypot,
      });

      if (res.confirmationRequired) {
        setPendingEmail(res.email || form.email.trim().toLowerCase());
        setStep('confirmation');
        toast.success('Check your email and click the confirmation link to activate your account.');
        return;
      }

      toast.success('Account created.');
      navigate(homeForRole(res.user.role), { replace: true });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const result = await register({ ...form, email: pendingEmail, website: honeypot });
      if (result.user) {
        navigate(homeForRole(result.user.role), { replace: true });
      } else {
        toast.success('Check your inbox and spam folder for the confirmation link.');
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'confirmation') {
    return (
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Verify your email</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Open the confirmation email{pendingEmail ? <> sent to <span className="font-semibold text-slate-700">{pendingEmail}</span></> : ''} and click its link.
          {' '}The link brings you back here and signs you in securely. Check your spam folder if it is missing.
        </p>

        <Link to={user ? homeForRole(user.role) : PATHS.login} className="btn-primary mt-7 w-full py-3">
          {user ? 'Continue to your account' : 'Back to sign in'}
        </Link>
        <div className="mt-5 flex items-center justify-between text-sm">
          {form.password ? <button
              type="button"
              onClick={resend}
              disabled={busy || booting}
              className="font-semibold text-brand-700 hover:underline disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Resend confirmation link'}
            </button> : <Link to={PATHS.register} state={{ email: pendingEmail }} className="font-semibold text-brand-700 hover:underline">
              Register again to resend
            </Link>}
          <button
            type="button"
            onClick={() => { setStep('form'); setErrors({}); }}
            className="text-slate-500 hover:underline"
          >
            Change email
          </button>
        </div>
      </div>
    );
  }

  const field = (key, label, type = 'text', extra = {}) => (
    <div>
      <label className="label" htmlFor={key}>{label}</label>
      <input
        id={key}
        type={type}
        className={`input ${errors[key] ? 'ring-rose-400' : ''}`}
        value={form[key]}
        onChange={set(key)}
        {...extra}
      />
      {errors[key] && <p className="mt-1 text-xs text-rose-600">{errors[key]}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-slate-900">Create your patient account</h1>
      <p className="mt-1.5 text-sm text-slate-500">Doctors and admins are provisioned by the clinic.</p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        {/* Bot trap: off-screen, unreachable by keyboard, ignored by humans. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
        {field('name', 'Full name', 'text', { placeholder: 'Jane Citizen', autoComplete: 'name' })}
        {field('email', 'Email', 'email', { placeholder: 'you@example.com', autoComplete: 'email' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('phone', 'Phone', 'tel', { placeholder: '+1 555 000 0000' })}
          {field('dob', 'Date of birth', 'date')}
        </div>
        <div>
          <span className="label">Gender</span>
          <div className="grid grid-cols-3 gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm((f) => ({ ...f, gender: g }))}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold ring-1 transition-all ${
                  form.gender === g ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {errors.gender && <p className="mt-1 text-xs text-rose-600">{errors.gender}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('password', 'Password', 'password', { placeholder: '••••••••', autoComplete: 'new-password' })}
          {field('confirmPassword', 'Confirm password', 'password', { placeholder: '••••••••', autoComplete: 'new-password' })}
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Password must be 8+ characters with uppercase, lowercase and a number.
        </p>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy || booting}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered? <Link to={PATHS.login} className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
