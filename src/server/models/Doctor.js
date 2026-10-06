/**
 * Doctor profile model — 1:1 with a DOCTOR User.
 * availability maps weekday -> which of the clinic slots the doctor works.
 */
const mongoose = require('mongoose');
const { DOCTOR_SLOTS, WEEKDAYS } = require('../config/constants');

const doctorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    doctorId: { type: String, required: true, unique: true, index: true },
    specialization: { type: String, required: true, trim: true, index: true },
    department: { type: String, required: true, trim: true, index: true },
    experience: { type: Number, required: true, min: 0, max: 60 },
    qualification: { type: String, trim: true, maxlength: 120, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewsCount: { type: Number, min: 0, default: 0 },
    consultationFee: { type: Number, min: 0, default: 0 },
    clinicInformation: {
      name: { type: String, trim: true, maxlength: 120, default: 'MedNexus Clinic' },
      address: { type: String, trim: true, maxlength: 200, default: '12 Wellness Avenue, Health City' },
      phone: { type: String, trim: true, maxlength: 20, default: '+1-555-0100' },
    },
    availability: {
      type: Map,
      of: { type: Array, of: String },
      default: () => new Map(),
    },
    isAcceptingNew: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.availability instanceof Map) {
          const plain = {};
          for (const [k, v] of ret.availability.entries()) plain[k] = v;
          ret.availability = plain;
        }
        return ret;
      },
    },
  }
);

/** Validate availability shape: weekday keys with valid slot strings. */
doctorSchema.methods.isSlotWithinAvailability = function isSlotWithinAvailability(dateISO, time) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()];
  const slots = this.availability && this.availability.get ? this.availability.get(weekday) : null;
  if (!Array.isArray(slots)) return false;
  return slots.includes(time);
};

module.exports = mongoose.model('Doctor', doctorSchema);
