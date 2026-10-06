import { Stethoscope, Pill, ClipboardList } from 'lucide-react';
import { formatDate } from '../../utils/format.js';

export default function RecordCard({ record }) {
  const r = record;
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Stethoscope className="h-4 w-4 text-brand-600" /> {r.diagnosis}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {r.recordId} · {formatDate(r.date)} · Dr. {(r.doctor?.name || '').replace('Dr. ', '')}
          </p>
        </div>
        <span className="badge bg-slate-100 text-slate-500 ring-1 ring-slate-200">Synthetic record</span>
      </div>
      {r.prescription && (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
          <Pill className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <span><span className="font-medium text-slate-500">Prescription:</span> {r.prescription}</span>
        </p>
      )}
      {r.notes && (
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <span>{r.notes}</span>
        </p>
      )}
    </div>
  );
}
