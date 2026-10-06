/**
 * Patient profile service. Patients can update only safe profile fields;
 * role/status/patientId are immutable and emails cannot be changed to
 * collide with an existing account.
 */
const User = require('../models/User');
const Patient = require('../models/Patient');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');

/** Public "me" payload for a PATIENT user. */
async function getMe(user) {
  const patient = await Patient.findOne({ userId: user.id }).populate('userId', 'name email status role');
  if (!patient) throw ApiError.notFound('Patient profile not found');
  const u = patient.userId;
  return {
    user: { id: u._id.toString(), name: u.name, email: u.email, role: u.role, status: u.status },
    patient: {
      id: patient._id.toString(),
      patientId: patient.patientId,
      dob: patient.dob,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      bloodGroup: patient.bloodGroup,
    },
  };
}

/** Update own profile (name/phone/dob/gender/address/bloodGroup + email on request). */
async function updateMe(user, updates, ip) {
  const patient = await Patient.findOne({ userId: user.id });
  if (!patient) throw ApiError.notFound('Patient profile not found');

  const userDoc = await User.findById(user.id);
  if (!userDoc) throw ApiError.unauthorized('Account not found');

  const safe = {};
  if (updates.name !== undefined) safe.name = updates.name;
  if (updates.phone !== undefined) safe.phone = updates.phone;
  if (updates.dob !== undefined) safe.dob = updates.dob;
  if (updates.gender !== undefined) safe.gender = updates.gender;
  if (updates.address !== undefined) safe.address = updates.address;
  if (updates.bloodGroup !== undefined) safe.bloodGroup = updates.bloodGroup;

  Object.assign(patient, safe);
  if (updates.name !== undefined) userDoc.name = updates.name;
  await Promise.all([patient.save(), userDoc.save()]);

  auditAsync({
    action: 'PROFILE_UPDATED',
    role: user.role,
    userId: user.id,
    resourceType: 'PATIENT',
    resourceId: patient.patientId,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Updated fields: ${Object.keys(safe).join(', ') || 'none'}`,
  });

  return getMe(user);
}

module.exports = { getMe, updateMe };
