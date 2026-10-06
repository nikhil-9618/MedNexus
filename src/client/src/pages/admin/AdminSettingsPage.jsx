import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Info } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Loader } from '../../components/common/Loader.jsx';

export default function AdminSettingsPage() {
  const toast = useToast();
  const { data, loading } = useAsync(() => adminService.settings(), []);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.items) setItems(data.items.map((s) => ({ ...s })));
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      await adminService.updateSettings(items.map(({ key, value }) => ({ key, value })));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader fullScreen label="Loading settings…" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">Clinic-wide configuration. Changes are audited.</p>
      </div>

      <div className="card divide-y divide-slate-100">
        {items.map((s, i) => (
          <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{s.label || s.key}</p>
              <p className="font-mono text-xs text-slate-500">{s.key}</p>
            </div>
            {typeof s.value === 'boolean' ? (
              <button
                onClick={() => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, value: !x.value } : x)))}
                className={`relative h-6 w-11 rounded-full transition-colors ${s.value ? 'bg-brand-600' : 'bg-slate-300'}`}
                aria-label={`Toggle ${s.key}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.value ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            ) : (
              <input
                type="number"
                className="input w-28 text-right"
                value={s.value}
                onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={busy}>
          <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="card flex items-start gap-3 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-800">About these settings</p>
          <p className="mt-1 text-slate-500">
            These values apply clinic-wide to booking and scheduling policy. Changes take effect
            immediately for every user in the clinic.
          </p>
        </div>
      </div>
    </div>
  );
}
