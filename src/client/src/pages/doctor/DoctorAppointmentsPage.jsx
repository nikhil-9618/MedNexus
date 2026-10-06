import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import AppointmentCard from '../../components/appointments/AppointmentCard.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import Pagination from '../../components/common/Pagination.jsx';

const TABS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

export default function DoctorAppointmentsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('Scheduled');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const list = useAsync(() => appointmentService.list({ status: tab, page, limit: 8 }), [tab, page]);

  async function setStatus(a, status) {
    setBusyId(a.id);
    try {
      await appointmentService.update(a.id, { status });
      toast.success(`Appointment ${status.toLowerCase()}`);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel() {
    setBusyId(cancelling.id);
    try {
      await appointmentService.cancel(cancelling.id);
      toast.success('Appointment cancelled');
      setCancelling(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Appointments</h2>
        <p className="mt-0.5 text-sm text-slate-500">Assigned appointments only — other doctors' bookings are never visible.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button key={s} onClick={() => { setTab(s); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-all ${
              tab === s ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {list.loading ? <SkeletonTable rows={4} /> : (list.data?.items || []).length === 0 ? (
        <EmptyState icon={CalendarClock} title={`No ${tab.toLowerCase()} appointments`} description="Bookings assigned to you will appear here." />
      ) : (
        <>
          <div className="space-y-3">
            {list.data.items.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                role="DOCTOR"
                onView={setSelected}
                onCancel={a.status === 'Completed' ? undefined : setCancelling}
                onStatus={setStatus}
                busy={busyId === a.id}
              />
            ))}
          </div>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} label="appointments" onChange={setPage} />
        </>
      )}

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        title="Cancel this appointment?"
        message={`The visit for ${cancelling?.patient?.name} on ${cancelling?.date} at ${cancelling?.time} will be cancelled and audited.`}
        confirmLabel="Cancel appointment"
        busy={busyId === cancelling?.id}
      />
    </div>
  );
}
