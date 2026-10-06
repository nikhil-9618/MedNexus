/**
 * Domain constants shared by models, services, validators and controllers.
 */

const ROLES = Object.freeze(['PATIENT', 'DOCTOR', 'ADMIN']);

const USER_STATUS = Object.freeze(['ACTIVE', 'SUSPENDED']);

const GENDERS = Object.freeze(['Male', 'Female', 'Other']);

const APPOINTMENT_STATUS = Object.freeze(['Scheduled', 'Confirmed', 'InQueue', 'NowServing', 'InConsultation', 'Completed', 'Cancelled', 'NoShow']);

/**
 * Allowed appointment status transitions.
 * Lifecycle: Scheduled -> Confirmed -> Completed, with cancellation
 * allowed from Scheduled or Confirmed. Anything else is rejected.
 */
const APPOINTMENT_TRANSITIONS = Object.freeze({
  Scheduled: Object.freeze(['Confirmed', 'Cancelled', 'NoShow']),
  Confirmed: Object.freeze(['InQueue', 'Cancelled', 'NoShow']),
  InQueue: Object.freeze(['NowServing', 'Cancelled', 'NoShow']),
  NowServing: Object.freeze(['InConsultation', 'Cancelled', 'NoShow']),
  InConsultation: Object.freeze(['Completed', 'Cancelled', 'Transferred']),
  Completed: Object.freeze([]),
  Cancelled: Object.freeze([]),
  NoShow: Object.freeze([]),
  Transferred: Object.freeze([]),
});

const RECORD_AUDIT = Object.freeze({
  VIEW: 'VIEW_MEDICAL_RECORD',
  CREATE: 'CREATE_MEDICAL_RECORD',
  UPDATE: 'UPDATE_MEDICAL_RECORD',
  VIEW_DENIED: 'VIEW_MEDICAL_RECORD_DENIED',
});

const QUEUE_STATUS = Object.freeze(['Waiting', 'NowServing', 'InConsultation', 'Completed', 'Cancelled']);

const CONSULTATION_STATUS = Object.freeze(['Pending', 'InProgress', 'Completed', 'Cancelled']);

const CONSULTATION_ACTIONS = Object.freeze([
  'START_CONSULTATION',
  'COMPLETE_CONSULTATION',
  'CANCEL_CONSULTATION',
  'CREATE_PRESCRIPTION',
  'ORDER_LAB_TEST',
  'VIEW_PATIENT_RECORD',
  'QUEUE_ADVANCE',
]);

const AUDIT_ACTIONS = Object.freeze([
  'REGISTER',
  'LOGIN',
  'FAILED_LOGIN',
  'LOGOUT',
  'LOGIN_BLOCKED',
  'BOOK_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'UPDATE_APPOINTMENT',
  'VIEW_MEDICAL_RECORD',
  'CREATE_MEDICAL_RECORD',
  'UPDATE_MEDICAL_RECORD',
  'VIEW_MEDICAL_RECORD_DENIED',
  'ADMIN_USER_UPDATE',
  'ADMIN_USER_DEACTIVATED',
  'ADMIN_USER_ACTIVATED',
  'DOCTOR_CREATED',
  'DOCTOR_UPDATED',
  'PATIENT_UPDATED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_DELETED',
  'PROFILE_UPDATED',
  'SETTINGS_UPDATED',
  'SECURITY_EVENT',
]);

const AUDIT_RESULTS = Object.freeze(['SUCCESS', 'DENIED', 'FAILED']);

const RESOURCE_TYPES = Object.freeze([
  'USER',
  'PATIENT',
  'DOCTOR',
  'APPOINTMENT',
  'MEDICAL_RECORD',
  'DEPARTMENT',
  'SETTING',
  'AUTH',
  'QUEUE',
  'CONSULTATION',
  'PRESCRIPTION',
  'LAB_ORDER',
]);

/**
 * Doctor consultation slots (24h). Kept as a fixed clinic schedule so
 * availability logic is deterministic and testable.
 */
const DOCTOR_SLOTS = Object.freeze([
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
]);

const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

const SPECIALIZATIONS = Object.freeze([
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Pediatrics',
  'General Medicine',
  'Neurology',
  'ENT',
  'Ophthalmology',
  'Psychiatry',
  'Gynecology',
]);

const DEPARTMENTS = Object.freeze([
  { code: 'CARD', name: 'Cardiology', description: 'Heart and vascular care' },
  { code: 'DERM', name: 'Dermatology', description: 'Skin, hair and nail care' },
  { code: 'ORTHO', name: 'Orthopedics', description: 'Bones, joints and muscles' },
  { code: 'PEDIA', name: 'Pediatrics', description: 'Child healthcare' },
  { code: 'GENMED', name: 'General Medicine', description: 'Primary and internal medicine' },
  { code: 'NEURO', name: 'Neurology', description: 'Brain and nervous system' },
]);

const PAGINATION = Object.freeze({
  defaultPage: 1,
  defaultLimit: 10,
  maxLimit: 100,
});

const RECENT_DAYS_WINDOW = 30;

const HOSPITAL_DEPTS = Object.freeze([
  { code: 'GENMED', name: 'General Medicine' },
  { code: 'CARD', name: 'Cardiology' },
  { code: 'DERM', name: 'Dermatology' },
  { code: 'ORTHO', name: 'Orthopedics' },
  { code: 'PEDIA', name: 'Pediatrics' },
  { code: 'NEURO', name: 'Neurology' },
  { code: 'ENT', name: 'ENT' },
  { code: 'OPHTH', name: 'Ophthalmology' },
  { code: 'GYN', name: 'Gynecology' },
  { code: 'EMER', name: 'Emergency' },
  { code: 'LAB', name: 'Laboratory' },
  { code: 'PHARM', name: 'Pharmacy' },
  { code: 'BILLING', name: 'Billing' },
  { code: 'WARD', name: 'Ward' },
]);

module.exports = {
  ROLES,
  USER_STATUS,
  GENDERS,
  APPOINTMENT_STATUS,
  APPOINTMENT_TRANSITIONS,
  AUDIT_ACTIONS,
  AUDIT_RESULTS,
  RESOURCE_TYPES,
  RECORD_AUDIT,
  DOCTOR_SLOTS,
  WEEKDAYS,
  SPECIALIZATIONS,
  DEPARTMENTS,
  PAGINATION,
  RECENT_DAYS_WINDOW,
  HOSPITAL_DEPTS,
};
