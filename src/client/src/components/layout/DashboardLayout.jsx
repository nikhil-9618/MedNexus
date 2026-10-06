import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Menu, X, LogOut,
  LayoutDashboard, UserRound, CalendarPlus, CalendarDays,
  FolderOpen, History, Sparkles, Users, Stethoscope, Building2,
  CalendarClock, ScrollText, Settings, FileText, Home, Boxes,
} from 'lucide-react';
import Logo from '../common/Logo.jsx';
import { Loader } from '../common/Loader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PATHS } from '../../routes/paths.js';

const NAV = {
  PATIENT: [
    { to: PATHS.patient.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: PATHS.patient.profile, label: 'Profile', icon: UserRound },
    { to: PATHS.patient.bookWizard, label: 'Book Appointment', icon: CalendarPlus },
    { to: PATHS.patient.appointments, label: 'My Appointments', icon: CalendarDays },
    { to: PATHS.patient.records, label: 'Medical Records', icon: FolderOpen },
    { to: PATHS.patient.history, label: 'Appointment History', icon: History },
    { to: PATHS.patient.assistant, label: 'Help / AI Assistant', icon: Sparkles },
  ],
  DOCTOR: [
    { to: PATHS.doctor.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: PATHS.doctor.appointments, label: 'Appointments', icon: CalendarDays },
    { to: PATHS.doctor.patients, label: 'My Patients', icon: Users },
    { to: PATHS.doctor.records, label: 'Medical Records', icon: FileText },
    { to: PATHS.doctor.history, label: 'History', icon: History },
    { to: PATHS.doctor.profile, label: 'My Profile', icon: UserRound },
    { to: PATHS.doctor.assistant, label: 'Help / AI Assistant', icon: Sparkles },
  ],
  ADMIN: [
    { to: PATHS.admin.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: PATHS.admin.patients, label: 'Manage Patients', icon: Users },
    { to: PATHS.admin.doctors, label: 'Manage Doctors', icon: Stethoscope },
    { to: PATHS.admin.appointments, label: 'Appointments', icon: CalendarDays },
    { to: PATHS.admin.departments, label: 'Departments', icon: Building2 },
    { to: PATHS.admin.availability, label: 'Availability', icon: CalendarClock },
    { to: PATHS.admin.digitalTwin, label: 'Digital Twin', icon: Boxes },
    { to: PATHS.admin.audit, label: 'Audit Logs', icon: ScrollText },
    { to: PATHS.admin.settings, label: 'Settings', icon: Settings },
  ],
};

/** Reference-style mobile bottom navigation (patient portal). */
const MOBILE_NAV = [
  { to: PATHS.patient.dashboard, label: 'Home', icon: Home },
  { to: PATHS.patient.appointments, label: 'Appointments', icon: CalendarDays },
  { to: PATHS.patient.records, label: 'Records', icon: FolderOpen },
  { to: PATHS.patient.profile, label: 'Profile', icon: UserRound },
];

export default function DashboardLayout({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV[user?.role] || [];
  const roleLabel = user?.role === 'PATIENT' ? 'Patient portal' : user?.role === 'DOCTOR' ? 'Doctor portal' : 'Admin console';

  async function handleLogout() {
    await logout();
    navigate(PATHS.home);
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Primary">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              isActive ? 'bg-brand-600 text-white shadow-card' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <l.icon className="h-4.5 w-4.5 shrink-0" />
          {l.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-brand-50/60 via-slate-50 to-slate-50">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to={PATHS.home} className="mr-2 hidden sm:block">
            <Logo size={36} withWordmark={false} />
          </NavLink>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{title || roleLabel}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right sm:block">
                <p className="max-w-[160px] truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {(user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            </div>
            <button onClick={handleLogout} className="btn-ghost px-3 py-2" title="Logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/60 lg:flex">
          {nav}
          {/* Logout at the bottom of the sidebar — reference layout */}
          <div className="border-t border-slate-200/70 px-3 py-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-4.5 w-4.5" /> Logout
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <Logo size={36} withWordmark={false} />
                <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close navigation">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <div className="border-t border-slate-200 px-3 py-3">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                >
                  <LogOut className="h-4.5 w-4.5" /> Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 ${user?.role === 'PATIENT' ? 'pb-24 lg:pb-8' : ''}`}>
          {/* Route-level code splitting: the sidebar, topbar and identity stay
              on screen while a workspace chunk loads on first visit. */}
          <Suspense fallback={<Loader fullScreen label="Loading workspace…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation — patient portal (reference) */}
      {user?.role === 'PATIENT' && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Mobile">
          <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
            {MOBILE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === PATHS.patient.dashboard}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${
                    isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-600'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
