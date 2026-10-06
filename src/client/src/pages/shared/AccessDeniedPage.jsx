import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import Logo from '../../components/common/Logo.jsx';

/** Reference-style Access Denied screen (spec §24). */
export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || 'this page';

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50/60 via-slate-50 to-slate-50">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo size={40} />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-10">
        <div className="card w-full p-8 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200">
            <ShieldX className="h-10 w-10 text-rose-600" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-rose-700">Access Denied</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account doesn't have access to <span className="font-semibold text-slate-800">{from}</span>.
            If you think this is a mistake, ask your clinic administrator.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <button onClick={() => navigate(-1)} className="btn-secondary px-5 py-2.5 text-xs">
              <ArrowLeft className="mr-1.5 inline h-4 w-4" /> Go Back
            </button>
            <button onClick={() => navigate('/')} className="btn-primary px-5 py-2.5 text-xs">Return home</button>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        MedNexus · Connected healthcare intelligence
      </footer>
    </div>
  );
}
