import { Link } from 'react-router-dom';
import { Target, Layers, HeartPulse } from 'lucide-react';
import { PATHS } from '../../routes/paths.js';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-600">About MedNexus</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">
        Connected healthcare intelligence.
      </h1>
      <p className="mt-5 text-base leading-7 text-slate-600">
        MedNexus is a full-stack clinic and appointment management platform built for the
        <span className="font-semibold text-slate-800"> PS-04 HealthTech</span> problem statement. It connects
        three personas — patients, doctors and clinic administrators — through one connected workflow
        for scheduling, consultation records and clinic operations.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <div className="card p-6">
          <Target className="h-6 w-6 text-brand-600" />
          <h3 className="mt-3 font-bold text-slate-900">The problem</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Clinics juggle appointments, records and staff coordination across disconnected tools,
            so patient journeys get fragmented and staff time is lost to admin work.
          </p>
        </div>
        <div className="card p-6">
          <Layers className="h-6 w-6 text-brand-600" />
          <h3 className="mt-3 font-bold text-slate-900">The solution</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            One connected workflow: conflict-free booking, doctor-authored consultations,
            digital prescriptions and lab orders, plus clinic-wide admin oversight.
          </p>
        </div>
        <div className="card p-6">
          <HeartPulse className="h-6 w-6 text-brand-600" />
          <h3 className="mt-3 font-bold text-slate-900">Data ethics</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Every patient, doctor, appointment and record in this deployment is synthetic demo data.
            No real health information is collected or stored.
          </p>
        </div>
      </div>

      <div className="card mt-10 p-6">
        <h2 className="font-bold text-slate-900">What's inside</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li>• Patient portal — doctors, booking, records, history</li>
          <li>• Doctor portal — schedule, patients, consultation records</li>
          <li>• Admin console — users, appointments, departments, settings</li>
          <li>• Queue management — department tokens, now-serving and consultation flow</li>
        </ul>
      </div>

      <div className="mt-8 flex gap-3">
        <Link to={PATHS.register} className="btn-primary">Get started</Link>
        <Link to={PATHS.contact} className="btn-secondary">Contact us</Link>
      </div>
    </div>
  );
}
