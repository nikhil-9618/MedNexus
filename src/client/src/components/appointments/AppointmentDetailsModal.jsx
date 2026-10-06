import Modal from '../common/Modal.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate, formatTime, formatDateTime } from '../../utils/format.js';

export default function AppointmentDetailsModal({ appointment, open, onClose }) {
  if (!appointment) return null;
  const a = appointment;
  return (
    <Modal open={open} onClose={onClose} title="Appointment details">
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Status</span>
          <StatusBadge status={a.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Date & time</span>
          <span className="font-semibold text-slate-800">{formatDate(a.date)} · {formatTime(a.time)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Doctor</span>
          <span className="font-semibold text-slate-800">{a.doctor?.name} {a.doctor?.specialization ? `· ${a.doctor.specialization}` : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Patient</span>
          <span className="font-semibold text-slate-800">{a.patient?.name} {a.patient?.patientId ? `(${a.patient.patientId})` : ''}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">Reason</span>
          <p className="mt-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-slate-700 ring-1 ring-slate-100">{a.reason}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Created {formatDateTime(a.createdAt)}</span>
          <span>Updated {formatDateTime(a.updatedAt)}</span>
        </div>
      </div>
    </Modal>
  );
}
