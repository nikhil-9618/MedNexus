export function SkeletonLine({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/80" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-3.5 w-1/2" />
          <SkeletonLine className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonLine />
        <SkeletonLine className="w-5/6" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <SkeletonLine className="h-3 w-1/2" />
          <SkeletonLine className="mt-3 h-7 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <SkeletonLine className="h-3 w-40" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <SkeletonLine className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="h-3.5 w-1/3" />
              <SkeletonLine className="h-3 w-1/4" />
            </div>
            <SkeletonLine className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
