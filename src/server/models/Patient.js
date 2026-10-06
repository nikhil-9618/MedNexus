/**
 * Patient profile model — 1:1 with a PATIENT User.
 * patientId is the short public identifier (e.g. "P1024") shown in UI/audit.
 */
const mongoose = require('mongoose');
const { GENDERS } = require('../config/constants');

const patientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    patientId: { type: String, required: true, unique: true, index: true },
    dob: { type: String, required: true }, // ISO "YYYY-MM-DD"
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    bloodGroup: { type: String, trim: true, maxlength: 5, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/** Searchable text index over the patient code. */
patientSchema.index({ patientId: 'text' });

module.exports = mongoose.model('Patient', patientSchema);
