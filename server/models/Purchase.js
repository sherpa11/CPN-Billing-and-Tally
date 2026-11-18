const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
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

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    purchaseNumberFormatted: {
      type: String,
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
    supplierPhone: {
      type: String,
      trim: true,
      default: '',
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    items: [purchaseItemSchema],
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
    cashPaid: {
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

purchaseSchema.index({ purchaseDate: -1, purchaseNumber: -1 });
purchaseSchema.index({ supplier: 1, purchaseDate: -1 });
purchaseSchema.index({ status: 1, purchaseDate: -1, purchaseNumber: -1 });
purchaseSchema.index({ supplier: 1, status: 1, purchaseDate: -1, purchaseNumber: -1 });
purchaseSchema.index({ purchaseNumber: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
