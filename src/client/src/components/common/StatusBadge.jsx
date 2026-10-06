import { statusClass } from '../../utils/format.js';

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ring-1 ${statusClass(status)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
