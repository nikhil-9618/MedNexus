import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout.jsx';
import AuthLayout from './components/layout/AuthLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import { RequireAuth, RequireRole } from './routes/ProtectedRoute.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import CookieConsent from './components/common/CookieConsent.jsx';

// The 3D digital twin pulls in three.js + drei (~860 kB) on top of the admin
// workspace. It loads only when an administrator opens it.
const AdminDigitalTwinPage = lazy(() => import('./pages/admin/AdminDigitalTwinPage.jsx'));

import LandingPage from './pages/public/LandingPage.jsx';
import AboutPage from './pages/public/AboutPage.jsx';
import TermsPage from './pages/public/TermsPage.jsx';
import PrivacyPage from './pages/public/PrivacyPage.jsx';
import ContactPage from './pages/public/ContactPage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

import AccessDeniedPage from './pages/shared/AccessDeniedPage.jsx';
import { PATHS } from './routes/paths.js';

// ---- Signed-in pages load on demand --------------------------------------
// A visitor on the public site should not download dashboard code, the chart
// library or the 3D twin. Each workspace below becomes its own chunk, fetched
// the first time that route is opened (the shell stays mounted while a chunk
// loads — see the Suspense boundary in DashboardLayout).
const PatientDashboardPage = lazy(() => import('./pages/patient/PatientDashboardPage.jsx'));
const FindDoctorsPage = lazy(() => import('./pages/patient/FindDoctorsPage.jsx'));
const DoctorProfilePage = lazy(() => import('./pages/patient/DoctorProfilePage.jsx'));
const BookAppointmentPage = lazy(() => import('./pages/patient/BookAppointmentPage.jsx'));
const BookingWizardPage = lazy(() => import('./pages/patient/BookingWizardPage.jsx'));
const AppointmentsPage = lazy(() => import('./pages/patient/AppointmentsPage.jsx'));
const AppointmentHistoryPage = lazy(() => import('./pages/patient/AppointmentHistoryPage.jsx'));
const RecordsPage = lazy(() => import('./pages/patient/RecordsPage.jsx'));
const PatientProfilePage = lazy(() => import('./pages/patient/PatientProfilePage.jsx'));

const DoctorDashboardPage = lazy(() => import('./pages/doctor/DoctorDashboardPage.jsx'));
const DoctorAppointmentsPage = lazy(() => import('./pages/doctor/DoctorAppointmentsPage.jsx'));
const DoctorPatientsPage = lazy(() => import('./pages/doctor/DoctorPatientsPage.jsx'));
const DoctorPatientDetailPage = lazy(() => import('./pages/doctor/DoctorPatientDetailPage.jsx'));
const DoctorRecordsPage = lazy(() => import('./pages/doctor/DoctorRecordsPage.jsx'));
const DoctorHistoryPage = lazy(() => import('./pages/doctor/DoctorHistoryPage.jsx'));
const DoctorOwnProfilePage = lazy(() => import('./pages/doctor/DoctorOwnProfilePage.jsx'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));
const AdminPatientsPage = lazy(() => import('./pages/admin/AdminPatientsPage.jsx'));
const AdminDoctorsPage = lazy(() => import('./pages/admin/AdminDoctorsPage.jsx'));
const AdminAppointmentsPage = lazy(() => import('./pages/admin/AdminAppointmentsPage.jsx'));
const AdminDepartmentsPage = lazy(() => import('./pages/admin/AdminDepartmentsPage.jsx'));
const AdminAvailabilityPage = lazy(() => import('./pages/admin/AdminAvailabilityPage.jsx'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage.jsx'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage.jsx'));

const AssistantPage = lazy(() => import('./pages/shared/AssistantPage.jsx'));

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* ---------- Public ---------- */}
        <Route element={<PublicLayout />}>
          <Route path={PATHS.home} element={<LandingPage />} />
          <Route path={PATHS.about} element={<AboutPage />} />
          <Route path={PATHS.terms} element={<TermsPage />} />
          <Route path={PATHS.privacy} element={<PrivacyPage />} />
          <Route path={PATHS.contact} element={<ContactPage />} />
        </Route>

        {/* ---------- Auth ---------- */}
        <Route element={<AuthLayout />}>
          <Route path={PATHS.login} element={<LoginPage />} />
          <Route path={PATHS.register} element={<RegisterPage />} />
          {/* Same component, own URL: lands directly on the verification step. */}
          <Route path={PATHS.verifyEmail} element={<RegisterPage />} />
        </Route>

        {/* ---------- Security ---------- */}
        <Route path={PATHS.accessDenied} element={<AccessDeniedPage />} />

        {/* ---------- Patient ---------- */}
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={['PATIENT']} />}>
            <Route path={PATHS.patient.root} element={<DashboardLayout title="Patient portal" />}>
              <Route index element={<PatientDashboardPage />} />
              <Route path="doctors" element={<FindDoctorsPage />} />
              <Route path="doctors/:id" element={<DoctorProfilePage />} />
              <Route path="doctors/:id/book" element={<BookAppointmentPage />} />
              <Route path="book" element={<BookingWizardPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="history" element={<AppointmentHistoryPage />} />
              <Route path="records" element={<RecordsPage />} />
              <Route path="profile" element={<PatientProfilePage />} />
              <Route path="assistant" element={<AssistantPage />} />
            </Route>
          </Route>

          {/* ---------- Doctor ---------- */}
          <Route element={<RequireRole roles={['DOCTOR']} />}>
            <Route path={PATHS.doctor.root} element={<DashboardLayout title="Doctor portal" />}>
              <Route index element={<DoctorDashboardPage />} />
              <Route path="appointments" element={<DoctorAppointmentsPage />} />
              <Route path="patients" element={<DoctorPatientsPage />} />
              <Route path="patients/:id" element={<DoctorPatientDetailPage />} />
              <Route path="records" element={<DoctorRecordsPage />} />
              <Route path="history" element={<DoctorHistoryPage />} />
              <Route path="profile" element={<DoctorOwnProfilePage />} />
              <Route path="assistant" element={<AssistantPage />} />
            </Route>
          </Route>

          {/* ---------- Admin ---------- */}
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path={PATHS.admin.root} element={<DashboardLayout title="Admin console" />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="patients" element={<AdminPatientsPage />} />
              <Route path="doctors" element={<AdminDoctorsPage />} />
              <Route path="appointments" element={<AdminAppointmentsPage />} />
              <Route path="departments" element={<AdminDepartmentsPage />} />
              <Route path="availability" element={<AdminAvailabilityPage />} />
              <Route
                path="digital-twin"
                element={
                  <Suspense
                    fallback={
                      <div className="flex h-[60vh] items-center justify-center text-sm font-semibold text-slate-500">
                        Loading 3D hospital twin…
                      </div>
                    }
                  >
                    <AdminDigitalTwinPage />
                  </Suspense>
                }
              />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/patient/*" element={<Navigate to={PATHS.patient.dashboard} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Essential-storage consent notice (public pages) */}
      <CookieConsent />
    </ErrorBoundary>
  );
}
