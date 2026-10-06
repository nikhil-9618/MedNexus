import { Outlet, NavLink } from 'react-router-dom';
import { CalendarCheck, HeartPulse, FolderOpen } from 'lucide-react';
import Logo from '../common/Logo.jsx';

export default function AuthLayout() {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <NavLink to="/" className="inline-flex w-fit rounded-2xl bg-white px-6 py-4 shadow-pop">
            <Logo size={44} />
          </NavLink>
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight text-white">
              Care that stays<br />connected.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-brand-100/80">
              Appointments, consultations, prescriptions and lab reports — one continuous
              record for every patient.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-brand-100/90">
              <li className="flex items-center gap-2.5">
                <CalendarCheck className="h-4 w-4 text-brand-300" /> Book and manage appointments
              </li>
              <li className="flex items-center gap-2.5">
                <HeartPulse className="h-4 w-4 text-brand-300" /> Live consultation and queue flow
              </li>
              <li className="flex items-center gap-2.5">
                <FolderOpen className="h-4 w-4 text-brand-300" /> Complete medical history
              </li>
            </ul>
          </div>
          <p className="text-xs text-brand-200/60">Synthetic / demo data only — no real patient information.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="p-6 lg:hidden">
          <NavLink to="/"><Logo /></NavLink>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16 pt-2 sm:px-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
