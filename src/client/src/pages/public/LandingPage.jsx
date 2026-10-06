import { Link } from 'react-router-dom';
import {
  CalendarCheck2, FolderOpen, HeartPulse, ClipboardList, ArrowRight, CheckCircle2,
  Stethoscope, CalendarClock, Users, UserPlus, CalendarPlus, Ticket, ListOrdered,
  FlaskConical, ShieldCheck,
} from 'lucide-react';
import MedNexusLogo from '../../components/common/MedNexusLogo.jsx';
import { PATHS, homeForRole } from '../../routes/paths.js';
import { useAuth } from '../../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: 'Appointments without clashes',
    text: 'Live slot availability per doctor, with the slot locked at booking time so the same time can never be sold twice.',
  },
  {
    icon: Ticket,
    title: 'Department queues and tokens',
    text: 'Every booking issues a department token. Patients follow their own position while reception calls the next token.',
  },
  {
    icon: ClipboardList,
    title: 'Consultations, prescriptions, labs',
    text: 'Doctors record vitals, diagnosis and notes, then issue prescriptions and lab orders from the same consultation.',
  },
  {
    icon: FolderOpen,
    title: 'One continuous medical history',
    text: 'Consultations, prescriptions and lab reports stay linked to the patient, so the whole care journey reads as one timeline.',
  },
];

const WORKFLOW = [
  {
    icon: UserPlus,
    title: 'Register',
    system: 'Patient account created',
    detail: 'A patient signs up once and gets a single private record with a unique patient ID.',
  },
  {
    icon: CalendarPlus,
    title: 'Book',
    system: 'Status: Scheduled',
    detail: 'The patient picks a doctor and an available slot. The time is locked immediately.',
  },
  {
    icon: Ticket,
    title: 'Token issued',
    system: 'e.g. GENMED-014',
    detail: 'Booking issues a token for the doctor\u2019s department and places the patient in that queue.',
  },
  {
    icon: ListOrdered,
    title: 'Queue',
    system: 'Waiting \u2192 Now serving',
    detail: 'The patient tracks their live position; the clinic advances the queue when the room is free.',
  },
  {
    icon: Stethoscope,
    title: 'Consultation',
    system: 'In consultation \u2192 Completed',
    detail: 'The doctor records vitals, observations, diagnosis and clinical notes against that appointment.',
  },
  {
    icon: FlaskConical,
    title: 'Prescription & lab',
    system: 'RX-20261006-0004 · LAB-20261006-0012',
    detail: 'Prescriptions and lab orders are raised in the same consultation and remain linked to it.',
  },
  {
    icon: FolderOpen,
    title: 'History & follow-up',
    system: 'Full medical timeline',
    detail: 'Every visit, prescription and report joins one history the patient and their doctor can both read.',
  },
];

const ROLES = [
  {
    icon: HeartPulse,
    title: 'Patients',
    points: [
      'Book appointments with live slot availability',
      'Follow your own queue position and consultation',
      'Read prescriptions, lab reports and full history',
    ],
  },
  {
    icon: Stethoscope,
    title: 'Doctors',
    points: [
      "Today's schedule and patient queue in one view",
      'Record vitals, diagnosis and clinical notes',
      'Issue prescriptions and order lab tests',
    ],
  },
  {
    icon: CalendarClock,
    title: 'Administrators',
    points: [
      'Manage patients, doctors and departments',
      'Monitor appointments and department queues',
      'Oversee clinic-wide day-to-day operations',
    ],
  },
];

const DEPARTMENTS = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Orthopedics', 'Pediatrics',
  'Neurology', 'ENT', 'Ophthalmology', 'Gynecology', 'Emergency',
  'Laboratory', 'Pharmacy', 'Billing', 'Ward',
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(65%_55%_at_50%_0%,rgba(37,144,175,0.16),transparent)]" />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 lg:pb-28 lg:pt-24">
          <MedNexusLogo height={128} className="drop-shadow-sm" />

          <h1 className="mt-10 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            The intelligent operating layer
            <span className="block bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              for modern hospitals.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Connect patients, clinicians, departments, diagnostics, pharmacy and hospital
            operations through one secure intelligent platform.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <Link to={homeForRole(user.role)} className="btn-primary px-7 py-3.5 text-base">
                Enter MedNexus <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to={PATHS.register} className="btn-primary px-7 py-3.5 text-base">
                Enter MedNexus <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a href="#how-it-works" className="btn-secondary px-7 py-3.5 text-base">
              Explore the platform
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brand-500" /> Role-based access</li>
            <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-brand-500" /> Patient, doctor &amp; admin workspaces</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> Synthetic demo data only</li>
          </ul>
        </div>
      </section>

      {/* ---------------- How it works / workflow ---------------- */}
      <section id="how-it-works" className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">How MedNexus works</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From first registration to full medical history
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              One connected pathway. Each step below is a real state in the platform, and every
              stage stays linked to the patient who moved through it.
            </p>
          </div>

          <ol className="mt-14 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map((w, i) => (
              <li key={w.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <w.icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    STEP {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{w.title}</h3>
                <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                  {w.system}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{w.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-100 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Departments on the platform
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DEPARTMENTS.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything your clinic needs
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Appointment workflows, consultations, records and administration — all in one place.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card group p-6 transition-shadow hover:shadow-pop">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section className="bg-brand-950 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-brand-200 ring-1 ring-white/15">
              <Users className="h-3.5 w-3.5" /> One platform, three experiences
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for every role
            </h2>
            <p className="mt-4 text-base leading-7 text-brand-100/85">
              Patients, doctors and administrators each get a workspace shaped around their own day.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">{r.title}</h3>
                <ul className="mt-3 space-y-2.5 text-sm text-brand-100/85">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-24">
        <MedNexusLogo height={72} className="mx-auto" />
        <h2 className="mt-8 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Ready to explore MedNexus?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
          Sign in with a demo account or create your own — every record in this deployment is
          synthetic demo data.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={PATHS.register} className="btn-primary px-6 py-3">Create a patient account</Link>
          <Link to={PATHS.login} className="btn-secondary px-6 py-3">Use a demo account</Link>
        </div>
      </section>
    </div>
  );
}
