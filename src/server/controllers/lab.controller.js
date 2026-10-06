const { wrapAll } = require('../utils/asyncHandler');
const workflowService = require('../services/workflow.service');
const LabOrder = require('../models/LabOrder');
const Patient = require('../models/Patient');
const { getPagination } = require('../utils/query');

/**
 * GET /api/lab-orders/:orderId — authorized read.
 */
async function getLabOrder(req, res) {
  const order = await workflowService.getLabOrderWithAuth(req.params.orderId, req.user);
  return res.json({ success: true, labOrder: workflowService.hydrateLabOrder(order) });
}

/**
 * GET /api/patients/me/lab-orders — patient's own lab orders.
 */
async function myLabOrders(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LabOrder.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('doctorId', 'doctorId specialization department userId')
      .populate('orderedBy', 'name')
      .lean(),
    LabOrder.countDocuments({ patientId: patient._id }),
  ]);
  return res.json({
    success: true,
    items: items.map(workflowService.hydrateLabOrder),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

module.exports = { getLabOrder, myLabOrders };

wrapAll(module.exports);
