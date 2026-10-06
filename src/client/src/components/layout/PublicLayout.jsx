import { NavLink, Outlet, Link } from 'react-router-dom';
import Logo from '../common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeForRole, PATHS } from '../../routes/paths.js';

export default function PublicLayout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <NavLink to={PATHS.home}><Logo /></NavLink>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <NavLink to={PATHS.about} className="hover:text-brand-700">About</NavLink>
            <NavLink to={PATHS.terms} className="hover:text-brand-700">Terms</NavLink>
            <NavLink to={PATHS.privacy} className="hover:text-brand-700">Privacy</NavLink>
            <NavLink to={PATHS.contact} className="hover:text-brand-700">Contact</NavLink>
          </nav>
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link to={homeForRole(user.role)} className="btn-primary">Go to dashboard</Link>
            ) : (
              <>
                <Link to={PATHS.login} className="btn-ghost hidden sm:inline-flex">Sign In</Link>
                <Link to={PATHS.register} className="btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              Clinic and appointment management for patients, doctors and administrators —
              booking, consultations, records and prescriptions in one place.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link className="hover:text-brand-700" to={PATHS.about}>About</Link></li>
              <li><Link className="hover:text-brand-700" to={PATHS.contact}>Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Account</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link className="hover:text-brand-700" to={PATHS.login}>Login</Link></li>
              <li><Link className="hover:text-brand-700" to={PATHS.register}>Register</Link></li>
              <li><Link className="hover:text-brand-700" to={PATHS.terms}>Terms</Link></li>
              <li><Link className="hover:text-brand-700" to={PATHS.privacy}>Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} MedNexus · Connected healthcare intelligence · All data is synthetic/demo.
        </div>
      </footer>
    </div>
  );
}
