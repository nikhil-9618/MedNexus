import { Stethoscope, ClipboardList, Activity } from 'lucide-react';

/** Static preview card shown in the landing hero — mirrors the real product UI. */
export default function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-brand-100/30 to-transparent blur-2xl" />
      <div className="card overflow-hidden p-0 shadow-pop">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <p className="text-[11px] font-semibold text-slate-500">mednexus.app/patient</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-5">
          <div className="space-y-3 sm:col-span-3">
            <div className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white">
              <p className="text-[11px] font-semibold text-brand-100">Upcoming appointment</p>
              <p className="mt-1.5 text-sm font-bold">Tomorrow · 10:30 AM</p>
              <p className="mt-0.5 text-xs text-brand-100/80">Dr. Ananya Sharma · Cardiology</p>
              <span className="mt-2.5 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-white/20">
                CONFIRMED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">Completed visits</p>
                <p className="mt-1 font-display text-lg font-bold text-slate-900">12</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">Medical records</p>
                <p className="mt-1 font-display text-lg font-bold text-slate-900">8</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Stethoscope className="h-3.5 w-3.5" /> Doctor</p>
              <p className="mt-1 text-sm font-bold text-slate-900">Dr. Ananya Sharma</p>
              <p className="text-xs text-slate-500">Cardiology · 12 yrs</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Activity className="h-3.5 w-3.5" /> Appointment status</p>
              <p className="mt-1 text-sm font-bold text-emerald-600">Confirmed</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><ClipboardList className="h-3.5 w-3.5" /> Queue</p>
              <p className="mt-1 text-sm font-bold text-slate-900">Token A-014</p>
              <p className="text-xs text-slate-500">3rd in Cardiology</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
