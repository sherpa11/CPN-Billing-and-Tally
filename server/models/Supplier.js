const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      index: true,
    },
    tamilName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastTransactionDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ name: 'text', tamilName: 'text', phone: 'text' });
supplierSchema.index({ isActive: 1, isDeleted: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
