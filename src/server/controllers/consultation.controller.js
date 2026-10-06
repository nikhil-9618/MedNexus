const { wrapAll } = require('../utils/asyncHandler');
const workflowService = require('../services/workflow.service');

/**
 * GET /api/consultations/:identifier
 * Patient may read own consultations; doctor may read their own; admin all.
 */
async function getConsultation(req, res) {
  const c = await workflowService.getConsultationWithAuth(req.params.identifier, req.user);
  return res.json({ success: true, consultation: workflowService.hydrateConsultation(c) });
}

module.exports = { getConsultation };

wrapAll(module.exports);
