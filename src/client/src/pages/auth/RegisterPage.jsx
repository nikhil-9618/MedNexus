import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { apiError, apiFieldErrors } from '../../services/api.js';
import { PATHS, homeForRole } from '../../routes/paths.js';
import { Loader } from '../../components/common/Loader.jsx';

const GENDERS = ['Female', 'Male', 'Other'];

export default function RegisterPage() {
  const { register, verifyOtp, resendOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', dob: '', gender: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Bot traps: a hidden field and the render time. Both are discarded by the
  // API's register handler (see src/server/controllers/auth.controller.js).
  const [honeypot, setHoneypot] = useState('');
  const formStartedAt = useRef(Date.now());
  // Email verification step
  const [step, setStep] = useState('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!/^[+]?[\d\s()-]{7,20}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number';
    if (!form.dob) errs.dob = 'Select your date of birth';
    else if (new Date(form.dob) > new Date()) errs.dob = 'Date of birth cannot be in the future';
    if (!GENDERS.includes(form.gender)) errs.gender = 'Select a gender';
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = 'At least 8 characters with upper, lower and a number';
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
        formStartedAt: formStartedAt.current,
      });

      // The account exists but no session is opened until the emailed code
      // is confirmed, so move the user to the verification step.
      if (res && res.otpRequired) {
        setPendingEmail(res.email || form.email.trim().toLowerCase());
        setDevOtp(res.devOtp || '');
        setStep('otp');
        toast.success('Check your email for the 6-digit verification code.');
        return;
      }

      toast.success('Account created.');
      navigate(homeForRole('PATIENT'), { replace: true });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setErrors({ otp: 'Enter the 6-digit code from your email' });
      return;
    }
    setBusy(true);
    try {
      const user = await verifyOtp(pendingEmail, otp.trim());
      toast.success(`Email verified — welcome to MedNexus, ${user.name.split(' ')[0]}!`);
      navigate(homeForRole(user.role), { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const res = await resendOtp(pendingEmail);
      if (res && res.devOtp) setDevOtp(res.devOtp);
      toast.success(res?.message || 'A new code has been sent.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  /* ---- Step 2: email verification ---- */
  if (step === 'otp') {
    return (
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Verify your email</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-slate-700">{pendingEmail}</span>. Enter it below to
          activate your account.
        </p>

        <form onSubmit={submitOtp} className="mt-7 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="otp">Verification code</label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`input text-center font-mono text-lg tracking-[0.5em] ${errors.otp ? 'ring-rose-400' : ''}`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              aria-invalid={!!errors.otp}
            />
            {errors.otp && <p className="mt-1 text-xs text-rose-600">{errors.otp}</p>}
          </div>

          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Loader label="Verifying…" /> : 'Verify & continue'}
          </button>
        </form>

        {devOtp && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 ring-1 ring-amber-200">
            <span className="font-bold">Development mode:</span> no email provider is configured, so
            the code is shown here and written to the server log —{' '}
            <span className="font-mono font-bold">{devOtp}</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm">
          <button type="button" onClick={resend} disabled={busy} className="font-semibold text-brand-700 hover:underline disabled:opacity-50">
            Resend code
          </button>
          <button
            type="button"
            onClick={() => { setStep('form'); setOtp(''); setErrors({}); }}
            className="text-slate-500 hover:underline"
          >
            Use a different email
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
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered? <Link to={PATHS.login} className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
