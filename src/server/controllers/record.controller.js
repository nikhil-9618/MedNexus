const { wrapAll } = require('../utils/asyncHandler');
/**
 * Medical-record controller. Every route requires auth; authorization is
 * enforced in record.service (patient ownership / doctor relationship /
 * admin policy) and each access is audited.
 */
const recordService = require('../services/record.service');
const Patient = require('../models/Patient');
const { getPagination } = require('../utils/query');

/** GET /api/records/patient/:patientId?category=lab */
async function listForPatient(req, res) {
  const { page, limit } = getPagination(req.query);
  const result = await recordService.listRecordsForPatient(
    req.params.patientId,
    req.user,
    { page, limit, category: req.query.category },
    req.ip
  );
  res.json({ success: true, ...result });
}

/** GET /api/records/:id */
async function getOne(req, res) {
  const record = await recordService.getRecord(req.params.id, req.user, req.ip);
  res.json({ success: true, record });
}

/** POST /api/records — doctor only (validated in service). */
async function create(req, res) {
  const record = await recordService.createRecord(req.body, req.user, req.ip);
  res.status(201).json({ success: true, message: 'Medical record created', record: recordService.hydrateRecord(await record.populate([
    { path: 'doctorId', select: 'doctorId userId', populate: { path: 'userId', select: 'name' } },
    { path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } },
  ])) });
}

/** PUT /api/records/:id — authoring doctor only. */
async function update(req, res) {
  const record = await recordService.updateRecord(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'Record updated', record: recordService.hydrateRecord(await record.populate([
    { path: 'doctorId', select: 'doctorId userId', populate: { path: 'userId', select: 'name' } },
    { path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } },
  ])) });
}

module.exports = { listForPatient, getOne, create, update };

wrapAll(module.exports);
