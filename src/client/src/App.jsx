import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout.jsx';
import AuthLayout from './components/layout/AuthLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import { RequireAuth, RequireRole } from './routes/ProtectedRoute.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import CookieConsent from './components/common/CookieConsent.jsx';

// The 3D digital twin pulls in three.js + drei (~870 kB). It is admin-only, so
// it is loaded on demand instead of shipping in the initial bundle.
const AdminDigitalTwinPage = lazy(() => import('./pages/admin/AdminDigitalTwinPage.jsx'));

import LandingPage from './pages/public/LandingPage.jsx';
import AboutPage from './pages/public/AboutPage.jsx';
import TermsPage from './pages/public/TermsPage.jsx';
import PrivacyPage from './pages/public/PrivacyPage.jsx';
import ContactPage from './pages/public/ContactPage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

import PatientDashboardPage from './pages/patient/PatientDashboardPage.jsx';
import FindDoctorsPage from './pages/patient/FindDoctorsPage.jsx';
import DoctorProfilePage from './pages/patient/DoctorProfilePage.jsx';
import BookAppointmentPage from './pages/patient/BookAppointmentPage.jsx';
import AppointmentsPage from './pages/patient/AppointmentsPage.jsx';
import AppointmentHistoryPage from './pages/patient/AppointmentHistoryPage.jsx';
import RecordsPage from './pages/patient/RecordsPage.jsx';
import PatientProfilePage from './pages/patient/PatientProfilePage.jsx';

import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage.jsx';
import DoctorAppointmentsPage from './pages/doctor/DoctorAppointmentsPage.jsx';
import DoctorPatientsPage from './pages/doctor/DoctorPatientsPage.jsx';
import DoctorPatientDetailPage from './pages/doctor/DoctorPatientDetailPage.jsx';
import DoctorRecordsPage from './pages/doctor/DoctorRecordsPage.jsx';
import DoctorHistoryPage from './pages/doctor/DoctorHistoryPage.jsx';
import DoctorOwnProfilePage from './pages/doctor/DoctorOwnProfilePage.jsx';

import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminPatientsPage from './pages/admin/AdminPatientsPage.jsx';
import AdminDoctorsPage from './pages/admin/AdminDoctorsPage.jsx';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage.jsx';
import AdminDepartmentsPage from './pages/admin/AdminDepartmentsPage.jsx';
import AdminAvailabilityPage from './pages/admin/AdminAvailabilityPage.jsx';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage.jsx';
import AdminSettingsPage from './pages/admin/AdminSettingsPage.jsx';

import AssistantPage from './pages/shared/AssistantPage.jsx';
import AccessDeniedPage from './pages/shared/AccessDeniedPage.jsx';
import BookingWizardPage from './pages/patient/BookingWizardPage.jsx';
import { PATHS } from './routes/paths.js';

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
