const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

// @desc Get Shop Settings
// @route GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        shopName: 'CPN VEGETABLES',
        tamilHeaderInvocation: 'உ',
        tamilHeaderDeity: 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை',
        tamilBusinessDescription: 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி',
        address: '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.',
        contactNumbers: ['97152 67025', '97882 29090'],
        footerText: 'வாழ்க வளமுடன்',
        primaryColor: '#034D28',
        secondaryColor: '#FFFFFF',
        billPrefix: 'CPN',
        paperSize: 'A5',
        logoUrl: '/cpn_logo.png',
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update Shop Settings
// @route PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    const previousState = settings.toObject();

    const {
      shopName,
      tamilHeaderInvocation,
      tamilHeaderDeity,
      tamilBusinessDescription,
      address,
      contactNumbers,
      footerText,
      primaryColor,
      secondaryColor,
      billPrefix,
      paperSize,
      logoUrl,
    } = req.body;

    if (shopName) settings.shopName = shopName.trim();
    if (tamilHeaderInvocation !== undefined) settings.tamilHeaderInvocation = tamilHeaderInvocation.trim();
    if (tamilHeaderDeity !== undefined) settings.tamilHeaderDeity = tamilHeaderDeity.trim();
    if (tamilBusinessDescription !== undefined) settings.tamilBusinessDescription = tamilBusinessDescription.trim();
    if (address !== undefined) settings.address = address.trim();
    if (contactNumbers !== undefined) {
      settings.contactNumbers = Array.isArray(contactNumbers)
        ? contactNumbers
        : contactNumbers.split(',').map((s) => s.trim());
    }
    if (footerText !== undefined) settings.footerText = footerText.trim();
    if (primaryColor) settings.primaryColor = primaryColor.trim();
    if (secondaryColor) settings.secondaryColor = secondaryColor.trim();
    if (billPrefix) settings.billPrefix = billPrefix.trim().toUpperCase();
    if (paperSize) settings.paperSize = paperSize;
    if (logoUrl) settings.logoUrl = logoUrl;

    await settings.save();

    await AuditLog.create({
      action: 'update_settings',
      entityType: 'settings',
      entityId: settings._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState,
      newState: settings.toObject(),
    });

    res.json({
      success: true,
      message: 'Shop settings updated successfully',
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
