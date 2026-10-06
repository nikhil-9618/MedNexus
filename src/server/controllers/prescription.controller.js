const { wrapAll } = require('../utils/asyncHandler');
const workflowService = require('../services/workflow.service');
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { getPagination } = require('../utils/query');

/**
 * GET /api/prescriptions/:prescriptionId — authorized read.
 */
async function getPrescription(req, res) {
  const rx = await workflowService.getPrescriptionWithAuth(req.params.prescriptionId, req.user);
  return res.json({ success: true, prescription: workflowService.hydratePrescription(rx) });
}

/**
 * GET /api/patients/me/prescriptions — patient's own prescriptions.
 */
async function myPrescriptions(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Prescription.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('doctorId', 'doctorId specialization department userId')
      .populate('issuedBy', 'name')
      .lean(),
    Prescription.countDocuments({ patientId: patient._id }),
  ]);
  return res.json({
    success: true,
    items: items.map(workflowService.hydratePrescription),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

module.exports = { getPrescription, myPrescriptions };

wrapAll(module.exports);
