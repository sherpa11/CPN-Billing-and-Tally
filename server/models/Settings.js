const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      default: 'CPN VEGETABLES',
    },
    tamilHeaderInvocation: {
      type: String,
      default: 'உ',
    },
    tamilHeaderDeity: {
      type: String,
      default: 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை',
    },
    tamilBusinessDescription: {
      type: String,
      default: 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி',
    },
    address: {
      type: String,
      default: '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.',
    },
    contactNumbers: {
      type: [String],
      default: ['97152 67025', '97882 29090'],
    },
    footerText: {
      type: String,
      default: 'வாழ்க வளமுடன்',
    },
    primaryColor: {
      type: String,
      default: '#034D28',
    },
    secondaryColor: {
      type: String,
      default: '#FFFFFF',
    },
    billPrefix: {
      type: String,
      default: 'CPN',
    },
    paperSize: {
      type: String,
      enum: ['A4', 'A5', 'A6', 'Thermal'],
      default: 'A6',
    },
    upiId: {
      type: String,
      default: 'rajapandi688-1@okaxis',
    },
    logoUrl: {
      type: String,
      default: '/cpn_logo.png',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Settings', settingsSchema);
