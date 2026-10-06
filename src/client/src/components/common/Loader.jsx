export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Loader({ label = 'Loading…', fullScreen = false, className = '' }) {
  const body = (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <Spinner />
      <span className="text-sm font-medium text-slate-500">{label}</span>
    </div>
  );
  if (!fullScreen) return body;
  return <div className="flex min-h-[60vh] items-center justify-center">{body}</div>;
}

export default Loader;
