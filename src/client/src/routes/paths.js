/** Centralized route paths. */
export const PATHS = {
  home: '/',
  about: '/about',
  terms: '/terms',
  privacy: '/privacy',
  contact: '/contact',
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  accessDenied: '/access-denied',

  patient: {
    root: '/patient',
    dashboard: '/patient',
    doctors: '/patient/doctors',
    doctorProfile: '/patient/doctors/:id',
    bookWizard: '/patient/book',
    book: '/patient/doctors/:id/book',
    appointments: '/patient/appointments',
    history: '/patient/history',
    records: '/patient/records',
    profile: '/patient/profile',
    assistant: '/patient/assistant',
  },
  doctor: {
    root: '/doctor',
    dashboard: '/doctor',
    appointments: '/doctor/appointments',
    patients: '/doctor/patients',
    records: '/doctor/records',
    history: '/doctor/history',
    profile: '/doctor/profile',
    assistant: '/doctor/assistant',
  },
  admin: {
    root: '/admin',
    dashboard: '/admin',
    patients: '/admin/patients',
    doctors: '/admin/doctors',
    appointments: '/admin/appointments',
    departments: '/admin/departments',
    availability: '/admin/availability',
    digitalTwin: '/admin/digital-twin',
    audit: '/admin/audit-logs',
    settings: '/admin/settings',
  },
};

export function homeForRole(role) {
  if (role === 'PATIENT') return PATHS.patient.dashboard;
  if (role === 'DOCTOR') return PATHS.doctor.dashboard;
  if (role === 'ADMIN') return PATHS.admin.dashboard;
  return PATHS.home;
}
