const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: Number,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque'],
      default: 'Cash',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    previousBalance: {
      type: Number,
      default: 0,
    },
    resultingBalance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'voided'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supplierPaymentSchema.index({ supplier: 1, paymentDate: -1 });
supplierPaymentSchema.index({ status: 1, paymentDate: -1, createdAt: -1 });
supplierPaymentSchema.index({ status: 1, purchase: 1, paymentDate: -1 });
supplierPaymentSchema.index({ supplier: 1, status: 1, paymentDate: -1 });

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
