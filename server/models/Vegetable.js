const mongoose = require('mongoose');

const vegetableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vegetable English name is required'],
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    tamilName: {
      type: String,
      trim: true,
      default: '',
    },
    defaultRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      default: 'Kg',
      trim: true,
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
    sortOrder: {
      type: Number,
      default: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate normalizedName for case-insensitive duplicate prevention
vegetableSchema.pre('validate', function () {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

vegetableSchema.index({ name: 'text', tamilName: 'text' });
vegetableSchema.index({ isDeleted: 1, isActive: 1, usageCount: -1, sortOrder: 1, name: 1 });
vegetableSchema.index({ normalizedName: 1, isDeleted: 1 });

module.exports = mongoose.model('Vegetable', vegetableSchema);
