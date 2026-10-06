import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, UserRound } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import RecordCard from '../../components/records/RecordCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { ageFrom, formatDate } from '../../utils/format.js';
import { PATHS } from '../../routes/paths.js';

export default function DoctorPatientDetailPage() {
  const { id } = useParams();
  const patientQ = useAsync(() => api.get(`/doctors/me/patients`, { params: { limit: 100 } }), []);
  const records = useAsync(() => api.get(`/records/patient/${id}`), [id]);

  if (patientQ.loading) return <Loader fullScreen label="Loading patient…" />;

  const patient = (patientQ.data?.items || []).find((p) => p.id === id);
  if (!patient) {
    return (
      <div className="card p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-rose-500" />
        <p className="mt-3 font-semibold text-slate-800">Patient not in your authorized list</p>
        <p className="mt-1 text-sm text-slate-500">You can only view patients assigned to you. This attempt is not permitted.</p>
        <Link to={PATHS.doctor.patients} className="btn-primary mt-4">Back to patients</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={PATHS.doctor.patients} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 font-display text-xl font-bold text-white">
            {patient.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-slate-900">{patient.name}</h2>
            <p className="text-sm text-slate-500">
              <span className="font-mono">{patient.patientId}</span> · {patient.gender || '—'} · {ageFrom(patient.dob)} yrs
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Authorized relationship
          </span>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <p className="text-xs font-semibold text-slate-500">Appointments with you</p>
            <p className="mt-0.5 font-bold text-slate-800">{patient.appointments}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <p className="text-xs font-semibold text-slate-500">Last completed visit</p>
            <p className="mt-0.5 font-bold text-slate-800">{patient.lastVisit ? formatDate(patient.lastVisit) : '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <p className="text-xs font-semibold text-slate-500">Account</p>
            <p className="mt-0.5 font-bold text-slate-800">{patient.status}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900"><FileText className="h-4 w-4 text-brand-600" /> Medical records (synthetic)</h3>
        {records.loading ? <SkeletonTable rows={3} /> : (records.data?.items || []).length === 0 ? (
          <EmptyState icon={UserRound} title="No records yet" description="Records you author during consultations appear here." />
        ) : (
          <div className="space-y-3">
            {records.data?.items.map((r) => <RecordCard key={r.id} record={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
