import {
  Users, Stethoscope, CalendarClock, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import StatCard from '../../components/common/StatCard.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { SkeletonStats, SkeletonCard } from '../../components/common/Skeleton.jsx';
import { formatDateShort } from '../../utils/format.js';

const PIE_COLORS = ['#2590af', '#43abc9', '#10b981', '#f43f5e'];
const BAR_COLOR = '#2590af';

export default function AdminDashboardPage() {
  const { data, loading, error } = useAsync(() => adminService.dashboard({ days: 14 }), []);
  const o = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Admin dashboard</h2>
        <p className="mt-0.5 text-sm text-slate-500">Live clinic analytics — computed from real appointment data.</p>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {loading ? <SkeletonStats /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total patients" value={o?.totals?.patients} tone="brand" />
          <StatCard icon={Stethoscope} label="Total doctors" value={o?.totals?.doctors} tone="violet" />
          <StatCard icon={CalendarClock} label="Today's appointments" value={o?.totals?.todayAppointments} tone="sky" />
          <StatCard icon={Activity} label="Upcoming" value={o?.totals?.upcoming} tone="amber" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Appointments by day */}
        <div className="lg:col-span-2">
          {loading ? <SkeletonCard /> : (
            <div className="card p-5">
              <SectionHeading title="Appointments — last 14 days" subtitle="Total bookings per day (all statuses)" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={o?.appointmentsByDay || []} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="apptFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#43abc9" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#43abc9" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip labelFormatter={formatDateShort} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" stroke="#2590af" strokeWidth={2.5} fill="url(#apptFill)" name="Appointments" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div>
          {loading ? <SkeletonCard /> : (
            <div className="card p-5">
              <SectionHeading title="Status distribution" subtitle="All appointments" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={(o?.statusDist || []).filter((s) => s.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {(o?.statusDist || []).map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Specialization distribution */}
      {loading ? <SkeletonCard /> : (
        <div className="card p-5">
          <SectionHeading title="Doctors by specialization" subtitle="Active doctors per specialization" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={o?.specializationDist || []} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="value" name="Doctors" fill={BAR_COLOR} radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
