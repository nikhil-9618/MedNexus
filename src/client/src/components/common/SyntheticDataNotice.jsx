import { FlaskConical } from 'lucide-react';

export default function SyntheticDataNotice({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ${className}`}>
      <FlaskConical className="h-4 w-4 shrink-0" />
      This application runs entirely on synthetic / demo data. No real patient information is stored.
    </div>
  );
}
