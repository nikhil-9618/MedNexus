/**
 * LabOrder model — laboratory test orders placed during a consultation.
 *
 * Each order has a unique order id and one or more ordered tests. When the
 * laboratory completes the order, a LabResult is attached with the report,
 * findings and recommendations.
 *
 * Lab orders are referenced from consultations and patient lab history.
 * Only authorized users may view them (patient whose record, the ordering
 * doctor, or admin).
 *
 * All lab content here is synthetic/demo data for development.
 */
const mongoose = require('mongoose');

const labResultSchema = new mongoose.Schema(
  {
    report: { type: String, trim: true, maxlength: 600, default: '' }, // e.g. summarised findings
    findings: { type: String, trim: true, maxlength: 800, default: '' }, // e.g. '(WBC) 7,200 /mm3'
    recommendations: { type: String, trim: true, maxlength: 400, default: '' }, // e.g. 'Review in 2 weeks'
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // lab technician / doctor
  },
  { _id: false }
);

const labOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true }, // e.g. LAB-20261005-0012
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    departmentCode: { type: String, required: true, trim: true, maxlength: 12 },
    status: {
      type: String,
      enum: Object.freeze(['Ordered', 'Processing', 'Completed', 'Cancelled']),
      default: 'Ordered',
      index: true,
    },
    tests: { type: [String], default: [], validate: { validator: function (arr) { return Array.isArray(arr) && arr.length > 0; }, message: 'A lab order must contain at least one test' } },
    // Free-text notes for the laboratory.
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    result: { type: labResultSchema, default: null },
    completedAt: { type: Date, default: null },
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

labOrderSchema.index({ patientId: 1, createdAt: -1 });
labOrderSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model('LabOrder', labOrderSchema);
