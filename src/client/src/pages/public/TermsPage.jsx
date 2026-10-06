export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Terms</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">
        Terms &amp; conditions
      </h1>
      <p className="mt-4 text-sm text-slate-500">
        Last updated: 6 October 2026 · MedNexus PS-04 HealthTech demo deployment
      </p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-600">
        <div className="card p-6">
          <h2 className="font-bold text-slate-900">1. What this service is</h2>
          <p className="mt-2">
            MedNexus is a hospital and clinic management platform covering appointments, department
            queues, consultations, prescriptions, laboratory orders and medical history. It is
            provided as a demonstration deployment for the Build Secure 24 PS-04 HealthTech
            problem statement.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">2. Demonstration data only</h2>
          <p className="mt-2">
            Every patient, doctor, appointment, consultation, prescription and laboratory record in
            this deployment is fictional data created by the platform's seed script. Do not enter
            real personal health information. You are responsible for ensuring that anything you
            type into this system is not real medical data.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">3. Acceptable use</h2>
          <p className="mt-2">
            Use the platform only for its intended purpose. You must not attempt to access records
            belonging to other accounts, probe or bypass role restrictions, disrupt the service,
            automate requests beyond normal use, or upload anything unlawful.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">4. Accounts and accuracy</h2>
          <p className="mt-2">
            You are responsible for the accuracy of the details you provide at registration and for
            keeping your password private. One account represents one person. Administrators may
            deactivate accounts that breach these terms.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">5. No medical advice</h2>
          <p className="mt-2">
            Nothing in MedNexus is medical advice, diagnosis or treatment. The built-in help
            assistant explains how to use the application only and never provides clinical guidance.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">6. Availability and changes</h2>
          <p className="mt-2">
            This is a demonstration deployment and is provided as-is, without warranties of
            availability or fitness for a particular purpose. Screens, workflows and these terms
            may change as the platform develops.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900">7. Contact</h2>
          <p className="mt-2">
            Questions about these terms can be raised through the contact page or at{' '}
            <span className="font-semibold text-slate-700">support@mednexus.demo</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
