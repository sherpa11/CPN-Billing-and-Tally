const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema(
  {
    vegetable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vegetable',
      default: null,
    },
    particulars: {
      type: String,
      required: [true, 'Particulars / Vegetable name is required'],
      trim: true,
    },
    tamilName: {
      type: String,
      trim: true,
      default: '',
    },
    rate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    bag: {
      type: Number,
      default: 0,
      min: 0,
    },
    weight: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    debit: {
      type: Number,
      default: 0,
      min: 0,
    },
    credit: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    billNumberFormatted: {
      type: String,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    billDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    items: [billItemSchema],
    totalBag: {
      type: Number,
      default: 0,
    },
    totalWeight: {
      type: Number,
      default: 0,
    },
    todayTotal: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    totalDebit: {
      type: Number,
      default: 0,
    },
    totalCredit: {
      type: Number,
      default: 0,
    },
    previousBalance: {
      type: Number,
      default: 0,
    },
    previousBalanceDate: {
      type: Date,
      default: null,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    varavu: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashReceived: {
      type: Number,
      default: 0,
    },
    closingBalance: {
      type: Number,
      default: 0,
    },
    billVersion: {
      type: String,
      enum: ['v1_legacy_6col', 'v2_new_5col', 'v3_new_6row'],
      default: 'v3_new_6row',
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    version: {
      type: Number,
      default: 1,
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

billSchema.index({ billDate: -1, billNumber: -1 });
billSchema.index({ customer: 1, billDate: -1 });
billSchema.index({ status: 1, billDate: -1, billNumber: -1 });
billSchema.index({ customer: 1, status: 1, billDate: -1, billNumber: -1 });
billSchema.index({ billNumber: -1 });

module.exports = mongoose.model('Bill', billSchema);
