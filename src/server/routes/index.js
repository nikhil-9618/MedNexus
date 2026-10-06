/**
 * All API routes. Order of guards: rate limit -> auth -> role -> validation
 * -> resource authorization (in services/middleware) -> controller.
 */
const express = require('express');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { validate } = require('../middleware/validation.middleware');
const auth = require('../middleware/auth.middleware');
const requireRoles = require('../middleware/role.middleware');

const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const doctorController = require('../controllers/doctor.controller');
const appointmentController = require('../controllers/appointment.controller');
const recordController = require('../controllers/record.controller');
const adminController = require('../controllers/admin.controller');
const assistantController = require('../controllers/assistant.controller');
const workflowController = require('../controllers/workflow.controller');
const prescriptionController = require('../controllers/prescription.controller');
const labController = require('../controllers/lab.controller');
const digitalTwinController = require('../controllers/digitalTwin.controller');

const {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  patientProfileSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');
const {
  bookingSchema,
  rescheduleSchema,
  statusUpdateSchema,
  appointmentQuerySchema,
  recordCreateSchema,
  recordUpdateSchema,
  recordQuerySchema,
} = require('../validators/appointment.validator');
const { objectIdParam } = require('../validators/objectId.validator');
const {
  patientQuerySchema,
  updatePatientStatusSchema,
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  appointmentAdminQuerySchema,
  auditQuerySchema,
  departmentSchema,
  departmentUpdateSchema,
  settingsSchema,
  analyticsQuerySchema,
} = require('../validators/admin.validator');

const router = express.Router();

// ---------------------------------------------------------------- Auth
const authRouter = express.Router();
authRouter.post('/register', validate({ body: registerSchema }), authController.register);
authRouter.post('/verify-otp', authLimiter, validate({ body: verifyOtpSchema }), authController.verifyEmailOtp);
authRouter.post('/resend-otp', authLimiter, validate({ body: resendOtpSchema }), authController.resendEmailOtp);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/logout', auth, authController.logout);
authRouter.get('/me', auth, authController.me);
authRouter.post('/change-password', auth, validate({ body: changePasswordSchema }), authController.changePassword);
router.use('/auth', authRouter);

// ------------------------------------------------------------ Patients
const patientRouter = express.Router();
patientRouter.use(auth);
patientRouter.get('/me', requireRoles('PATIENT', 'ADMIN'), patientController.getMe);
patientRouter.put('/me', requireRoles('PATIENT'), validate({ body: patientProfileSchema }), patientController.updateMe);
patientRouter.get('/me/records', requireRoles('PATIENT'), patientController.getMyRecords);
patientRouter.get('/me/dashboard', requireRoles('PATIENT'), patientController.getMyDashboard);
router.use('/patients', patientRouter);

// ------------------------------------------------------------- Doctors
const doctorRouter = express.Router();
doctorRouter.get('/', doctorController.listDoctors);
doctorRouter.get('/:id', doctorController.getDoctor);
doctorRouter.get('/:id/availability', doctorController.getAvailability);
const doctorSelfRouter = express.Router();
doctorSelfRouter.use(auth, requireRoles('DOCTOR'));
doctorSelfRouter.get('/appointments', doctorController.getMyAppointments);
doctorSelfRouter.get('/patients', doctorController.getMyPatients);
doctorSelfRouter.get('/dashboard', doctorController.getMyDashboard);
// Public directory first; self routes are mounted at /doctors/me so they
// cannot be shadowed by the /:id profile route.
router.use('/doctors', doctorRouter);
router.use('/doctors/me', doctorSelfRouter);

// -------------------------------------------------------- Appointments
const appointmentRouter = express.Router();
appointmentRouter.use(auth);
appointmentRouter.post(
  '/',
  requireRoles('PATIENT', 'ADMIN'),
  validate({ body: bookingSchema }),
  appointmentController.book
);
appointmentRouter.get('/', validate({ query: appointmentQuerySchema }), appointmentController.list);
appointmentRouter.get('/:id', appointmentController.getOne);
appointmentRouter.put('/:id', validate({ body: statusUpdateSchema.or(rescheduleShape()) }), appointmentController.update);
appointmentRouter.delete('/:id', appointmentController.cancel);
router.use('/appointments', appointmentRouter);

function rescheduleShape() {
  // status XOR reschedule in one PUT body
  return statusUpdateSchema.partial().and(rescheduleSchema.partial());
}

// ------------------------------------------------------------- Records
const recordRouter = express.Router();
recordRouter.use(auth);
recordRouter.get('/patient/:patientId', requireRoles('PATIENT', 'DOCTOR', 'ADMIN'), validate({ query: recordQuerySchema }), recordController.listForPatient);
recordRouter.get('/:id', requireRoles('PATIENT', 'DOCTOR', 'ADMIN'), recordController.getOne);
recordRouter.post('/', requireRoles('DOCTOR'), validate({ body: recordCreateSchema }), recordController.create);
recordRouter.put('/:id', requireRoles('DOCTOR'), validate({ body: recordUpdateSchema }), recordController.update);
router.use('/records', recordRouter);

// --------------------------------------------------------------- Admin
const adminRouter = express.Router();
adminRouter.use(auth, requireRoles('ADMIN'));
adminRouter.get('/dashboard', validate({ query: analyticsQuerySchema }), adminController.dashboard);
adminRouter.get('/patients', validate({ query: patientQuerySchema }), adminController.listPatients);
adminRouter.get('/patients/:id', adminController.getPatient);
adminRouter.put('/patients/:id/status', validate({ body: updatePatientStatusSchema }), adminController.setPatientStatus);
adminRouter.get('/doctors', adminController.listDoctors);
adminRouter.post('/doctors', validate({ body: createDoctorSchema }), adminController.createDoctor);
adminRouter.put('/doctors/:id', validate({ body: updateDoctorSchema }), adminController.updateDoctor);
adminRouter.put('/doctors/:id/status', validate({ body: updateDoctorStatusSchema }), adminController.setDoctorStatus);
adminRouter.get('/appointments', validate({ query: appointmentAdminQuerySchema }), adminController.listAppointments);
adminRouter.put('/appointments/:id/status', validate({ body: statusUpdateSchema }), adminController.updateAppointmentStatus);
adminRouter.get('/departments', adminController.listDepartments);
adminRouter.post('/departments', validate({ body: departmentSchema }), adminController.createDepartment);
adminRouter.put('/departments/:code', validate({ body: departmentUpdateSchema }), adminController.updateDepartment);
adminRouter.delete('/departments/:code', adminController.deleteDepartment);
adminRouter.get('/audit-logs', validate({ query: auditQuerySchema }), adminController.auditLogs);
adminRouter.get('/settings', adminController.getSettings);
adminRouter.put('/settings', validate({ body: settingsSchema }), adminController.updateSettings);
// Admin-only 3D digital twin — reads live aggregate counts from MongoDB.
adminRouter.get('/digital-twin', digitalTwinController.getDigitalTwin);
router.use('/admin', adminRouter);

// ----------------------------------------------------------- Assistant
const assistantRouter = express.Router();
assistantRouter.use(auth);
assistantRouter.get('/meta', assistantController.meta);
assistantRouter.post('/', assistantController.ask);
router.use('/assistant', assistantRouter);

// ---------------------------------------------------------------- Queues
const queueRouter = express.Router();
queueRouter.use(auth);
queueRouter.get('/', workflowController.listQueues);
queueRouter.post('/advance', auth, requireRoles('ADMIN', 'DOCTOR'), workflowController.advanceQueue);
router.use('/queues', queueRouter);

// -------------------------------------------------------- Consultations
const consultationRouter = express.Router();
consultationRouter.use(auth);
consultationRouter.get('/:identifier', requireRoles('PATIENT', 'DOCTOR', 'ADMIN'), workflowController.getConsultation);
consultationRouter.post('/:appointmentId/start', requireRoles('DOCTOR', 'ADMIN'), workflowController.startConsultation);
consultationRouter.post('/:appointmentId/complete', requireRoles('DOCTOR', 'ADMIN'), workflowController.completeConsultation);
router.use('/consultations', consultationRouter);

// --------------------------------------------- Patient history & notifications
const patientWorkflowRouter = express.Router();
patientWorkflowRouter.use(auth, requireRoles('PATIENT'));
patientWorkflowRouter.get('/history', workflowController.patientHistory);
patientWorkflowRouter.get('/prescriptions', workflowController.patientPrescriptions);
patientWorkflowRouter.get('/lab-orders', workflowController.patientLabOrders);
patientWorkflowRouter.get('/notifications', workflowController.patientNotifications);
patientWorkflowRouter.put('/notifications/:id/read', validate({ params: objectIdParam('id') }), workflowController.markNotificationRead);
router.use('/patients/me', patientWorkflowRouter);

// ----------------------------------------------- Prescriptions (object authz)
const prescriptionRouter = express.Router();
prescriptionRouter.use(auth);
prescriptionRouter.get('/me', requireRoles('PATIENT'), prescriptionController.myPrescriptions);
prescriptionRouter.get('/:id', requireRoles('PATIENT', 'DOCTOR', 'ADMIN'), prescriptionController.getPrescription);
router.use('/prescriptions', prescriptionRouter);

// ------------------------------------------------- Lab orders (object authz)
const labRouter = express.Router();
labRouter.use(auth);
labRouter.get('/me', requireRoles('PATIENT'), labController.myLabOrders);
labRouter.get('/:id', requireRoles('PATIENT', 'DOCTOR', 'ADMIN'), labController.getLabOrder);
router.use('/lab-orders', labRouter);

module.exports = router;
