const { wrapAll } = require('../utils/asyncHandler');
/**
 * Patient controller — profile get/update, own records list.
 */
const patientService = require('../services/patient.service');
const recordService = require('../services/record.service');
const { getPagination } = require('../utils/query');
const analyticsService = require('../services/analytics.service');
const Patient = require('../models/Patient');

/** GET /api/patients/me */
async function getMe(req, res) {
  const data = await patientService.getMe(req.user);
  res.json({ success: true, ...data });
}

/** PUT /api/patients/me */
async function updateMe(req, res) {
  const data = await patientService.updateMe(req.user, req.body, req.ip);
  res.json({ success: true, ...data });
}

/** GET /api/patients/me/records — own records, audited. */
async function getMyRecords(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  const { page, limit } = getPagination(req.query);
  const result = await recordService.listRecordsForPatient(
    patient._id.toString(),
    req.user,
    { page, limit, category: req.query.category },
    req.ip
  );
  res.json({ success: true, ...result });
}

/** GET /api/patients/me/dashboard — quick stats for the patient home. */
async function getMyDashboard(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) return res.json({ success: true, stats: null });
  const stats = await analyticsService.getPatientStats(patient._id);
  res.json({ success: true, stats });
}

module.exports = { getMe, updateMe, getMyRecords, getMyDashboard };

wrapAll(module.exports);
