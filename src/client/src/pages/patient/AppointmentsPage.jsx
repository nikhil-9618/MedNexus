import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { appointmentService } from '../../services/appointmentService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import AppointmentCard from '../../components/appointments/AppointmentCard.jsx';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal.jsx';
import RescheduleModal from '../../components/appointments/RescheduleModal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { todayISO } from '../../utils/dates.js';

export default function AppointmentsPage() {
  const toast = useToast();
  const today = todayISO();
  const [tab, setTab] = useState('upcoming');
  const [selected, setSelected] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = useAsync(() => appointmentService.list({ limit: 100 }), [tab]);

  const all = list.data?.items || [];
  const items = all.filter((a) => {
    if (tab === 'upcoming') return ['Scheduled', 'Confirmed'].includes(a.status) && a.date >= today;
    if (tab === 'past') return a.date < today || a.status === 'Completed';
    return true; // All
  });

  async function confirmCancel() {
    setBusy(true);
    try {
      await appointmentService.cancel(cancelling.id);
      toast.success('Appointment cancelled');
      setCancelling(null);
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel appointment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Appointments</h2>
        <p className="mt-0.5 text-sm text-slate-500">Manage your upcoming visits.</p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Appointment filters">
        {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-all ${
              tab === key ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.loading ? <SkeletonTable rows={4} /> : items.length === 0 ? (          <EmptyState
            icon={CalendarClock}
            title={tab === 'upcoming' ? 'No upcoming appointments.' : tab === 'past' ? 'No past appointments.' : 'No appointments yet.'}
            description={tab === 'upcoming' ? 'Book a visit from the Find Doctor page.' : tab === 'past' ? 'Completed and earlier visits will appear here.' : 'Book your first appointment to see it here.'}
          />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              role="PATIENT"
              onView={setSelected}
              onCancel={setCancelling}
              onReschedule={setRescheduling}
              busy={busy}
            />
          ))}
        </div>
      )}

      <AppointmentDetailsModal appointment={selected} open={!!selected} onClose={() => setSelected(null)} />
      <RescheduleModal
        appointment={rescheduling}
        open={!!rescheduling}
        onClose={() => setRescheduling(null)}
        onDone={(msg) => { toast.success(msg); list.refetch(); }}
      />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        title="Cancel this appointment?"
        message={`Your visit on ${cancelling?.date} at ${cancelling?.time} with ${cancelling?.doctor?.name} will be cancelled. This frees the slot for other patients.`}
        confirmLabel="Cancel appointment"
        busy={busy}
      />
    </div>
  );
}
