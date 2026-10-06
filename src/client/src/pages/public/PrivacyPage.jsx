export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Privacy</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">
        Privacy & data policy
      </h1>

      <div className="prose-slate mt-8 space-y-6 text-sm leading-7 text-slate-600">
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">1. Demo data only</h2>
          <p className="mt-2">
            MedNexus is a demonstration platform. Every patient, doctor, appointment, consultation,
            prescription and lab report you see is fictional demo data created by the seed script.
            No real person's health, contact or identity information is collected or stored.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">2. What the platform stores</h2>
          <p className="mt-2">
            For every account: a name, email, phone, date of birth, gender and a bcrypt-hashed
            password (never plaintext). Appointments store the date, time, reason and status. Consultations store
            vitals, diagnosis and notes. Prescriptions and lab orders store the items a doctor
            recorded for that visit.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">3. Who can see what</h2>
          <p className="mt-2">
            Patients can only ever read their own information. Doctors see the patients they are
            treating and the records they authored. Administrators manage clinic operations —
            accounts, departments, schedules and appointments.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">4. Your controls</h2>
          <p className="mt-2">
            You can update your profile details from the Profile page and change your password at
            any time. Your role, patient ID and access level cannot be self-modified.
          </p>
        </div>
      </div>
    </div>
  );
}
