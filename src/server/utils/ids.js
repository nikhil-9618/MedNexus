/**
 * Human-readable ID generation for synthetic entities.
 * Format: P#### for patients, D#### for doctors, R#### for records.
 */
const Counter = require('../models/Counter');

async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

const nextPatientCode = () => nextSequence('patient').then((n) => `P${1000 + n}`);
const nextDoctorCode = () => nextSequence('doctor').then((n) => `D${1000 + n}`);
const nextRecordCode = () => nextSequence('record').then((n) => `R${1000 + n}`);

module.exports = { nextSequence, nextPatientCode, nextDoctorCode, nextRecordCode };
