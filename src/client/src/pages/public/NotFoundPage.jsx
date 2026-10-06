import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PATHS } from '../../routes/paths.js';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-5xl font-extrabold text-slate-900">404</h1>
        <p className="mt-2 text-slate-500">We couldn't find that page.</p>
        <Link to={PATHS.home} className="btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  );
}
