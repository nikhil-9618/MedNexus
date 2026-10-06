import { useEffect, useState } from 'react';
import { CalendarCog, Save } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { doctorService } from '../../services/doctorService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { WEEKDAYS, SLOTS } from '../../utils/constants.js';
import { formatTime } from '../../utils/format.js';

export default function AdminAvailabilityPage() {
  const toast = useToast();
  const list = useAsync(() => adminService.doctors({ limit: 100 }), []);
  const [doctorId, setDoctorId] = useState('');
  const [availability, setAvailability] = useState({});
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const doctors = (list.data?.items || []).filter((d) => d.status === 'ACTIVE');

  useEffect(() => {
    if (!doctorId && doctors.length > 0) setDoctorId(doctors[0].id);
  }, [doctors]);

  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    setLoadingSlots(true);
    doctorService.get(doctorId)
      .then((res) => { if (live) { const av = {}; WEEKDAYS.forEach((w) => { av[w] = res.data.doctor.availability?.[w] || []; }); setAvailability(av); } })
      .catch(() => toast.error('Could not load availability'))
      .finally(() => { if (live) setLoadingSlots(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  function toggle(day, slot) {
    setAvailability((av) => {
      const cur = av[day] || [];
      const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot].sort();
      return { ...av, [day]: next };
    });
  }

  async function save() {
    setBusy(true);
    try {
      await adminService.updateDoctor(doctorId, { availability });
      toast.success('Availability saved');
      list.refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const doctor = doctors.find((d) => d.id === doctorId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Availability</h2>
        <p className="mt-0.5 text-sm text-slate-500">Configure each doctor's weekly consultation slots. Changes apply to new bookings immediately.</p>
      </div>

      {list.loading ? <SkeletonTable rows={4} /> : doctors.length === 0 ? (
        <EmptyState icon={CalendarCog} title="No active doctors" description="Add or activate doctors first." />
      ) : (
        <>
          <div className="card p-4">
            <label className="label" htmlFor="av-doc">Doctor</label>
            <select id="av-doc" className="input sm:max-w-md" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization} ({d.doctorId})</option>)}
            </select>
          </div>

          {loadingSlots ? <SkeletonTable rows={4} /> : (
            <div className="card space-y-2 p-5">
              {WEEKDAYS.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <span className="w-10 text-xs font-bold text-slate-500">{day}</span>
                  {SLOTS.map((slot) => {
                    const on = (availability[day] || []).includes(slot);
                    return (
                      <button key={slot} onClick={() => toggle(day, slot)}
                        className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ring-1 transition-colors ${on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-500 ring-slate-200 hover:ring-brand-300'}`}>
                        {slot}
                      </button>
                    );
                  })}
                  {(availability[day] || []).length === 0 && <span className="ml-1 text-[11px] text-slate-500">not working</span>}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  {doctor ? `Editing ${doctor.name}` : ''} · {Object.values(availability).flat().length} slots configured
                </p>
                <button className="btn-primary" onClick={save} disabled={busy}>
                  <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save availability'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
