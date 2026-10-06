import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange, total, label = 'items' }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of {pages}
        {typeof total === 'number' && <span className="hidden sm:inline"> · {total} {label}</span>}
      </p>
      <div className="flex items-center gap-2">
        <button className="btn-secondary px-3 py-2" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button className="btn-secondary px-3 py-2" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
