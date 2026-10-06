import { Mail, MessageSquareText, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths.js';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Contact</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">Get in touch</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
        Questions about MedNexus or the PS-04 HealthTech build? Reach the team through any of
        these demo channels.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <div className="card p-6">
          <Mail className="h-6 w-6 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">Email</h2>
          <p className="mt-1 text-sm text-slate-500">support@mednexus.demo</p>
        </div>
        <div className="card p-6">
          <MessageSquareText className="h-6 w-6 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">In-app assistant</h2>
          <p className="mt-1 text-sm text-slate-500">
            Signed-in users can ask the AI assistant for navigation help from the sidebar.
          </p>
          <Link to={PATHS.login} className="btn-secondary mt-3 px-3 py-2 text-xs">Open app</Link>
        </div>
        <div className="card p-6">
          <MapPin className="h-6 w-6 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">Clinic</h2>
          <p className="mt-1 text-sm text-slate-500">MedNexus Clinic<br />12 Wellness Avenue, Health City</p>
        </div>
      </div>

      <div className="card mt-8 p-6 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">Note:</span> this deployment is a portfolio/demo
        build running on synthetic data. Support channels are illustrative.
      </div>
    </div>
  );
}
