const Vegetable = require('../models/Vegetable');
const Settings = require('../models/Settings');
const Customer = require('../models/Customer');
const User = require('../models/User');

const defaultVegetables = [
  { name: 'Tomato', tamilName: 'தக்காளி', defaultRate: 35, unit: 'Kg' },
  { name: 'Onion', tamilName: 'பெரிய வெங்காயம்', defaultRate: 40, unit: 'Kg' },
  { name: 'Small Onion', tamilName: 'சின்ன வெங்காயம்', defaultRate: 65, unit: 'Kg' },
  { name: 'Potato', tamilName: 'உருளைக்கிழங்கு', defaultRate: 30, unit: 'Kg' },
  { name: 'Carrot', tamilName: 'கேரட்', defaultRate: 50, unit: 'Kg' },
  { name: 'Beans', tamilName: 'பீன்ஸ்', defaultRate: 60, unit: 'Kg' },
  { name: 'Cabbage', tamilName: 'முட்டைக்கோஸ்', defaultRate: 25, unit: 'Kg' },
  { name: 'Cauliflower', tamilName: 'காலிஃபிளவர்', defaultRate: 35, unit: 'Kg' },
  { name: 'Beetroot', tamilName: 'பீட்ரூட்', defaultRate: 45, unit: 'Kg' },
  { name: 'Brinjal', tamilName: 'கத்தரிக்காய்', defaultRate: 30, unit: 'Kg' },
  { name: 'Ladies Finger', tamilName: 'வெண்டைக்காய்', defaultRate: 35, unit: 'Kg' },
  { name: 'Green Chilli', tamilName: 'பச்சை மிளகாய்', defaultRate: 55, unit: 'Kg' },
  { name: 'Drumstick', tamilName: 'முருங்கைக்காய்', defaultRate: 70, unit: 'Kg' },
  { name: 'Cucumber', tamilName: 'வெள்ளரிக்காய்', defaultRate: 25, unit: 'Kg' },
  { name: 'Garlic', tamilName: 'பூண்டு', defaultRate: 180, unit: 'Kg' },
  { name: 'Ginger', tamilName: 'இஞ்சி', defaultRate: 120, unit: 'Kg' },
  { name: 'Capsicum', tamilName: 'குடைமிளகாய்', defaultRate: 60, unit: 'Kg' },
  { name: 'Radish', tamilName: 'முள்ளங்கி', defaultRate: 25, unit: 'Kg' },
  { name: 'Lemon', tamilName: 'எலுமிச்சை', defaultRate: 80, unit: 'Kg' },
  { name: 'Coriander', tamilName: 'கொத்தமல்லி', defaultRate: 40, unit: 'Kg' },
  { name: 'Mint', tamilName: 'புதினா', defaultRate: 30, unit: 'Kg' },
  { name: 'Chow Chow', tamilName: 'சௌ சௌ', defaultRate: 28, unit: 'Kg' },
  { name: 'Bottle Gourd', tamilName: 'சுரைக்காய்', defaultRate: 20, unit: 'Kg' },
  { name: 'Snake Gourd', tamilName: 'புடலங்காய்', defaultRate: 25, unit: 'Kg' },
  { name: 'Bitter Gourd', tamilName: 'பாகற்காய்', defaultRate: 45, unit: 'Kg' },
  { name: 'Green Peas', tamilName: 'பச்சை பட்டாணி', defaultRate: 90, unit: 'Kg' },
  { name: 'Curry Leaves', tamilName: 'கறிவேப்பிலை', defaultRate: 35, unit: 'Kg' },
];

/**
 * Production-safe initial database initialization:
 * - Initializes shop settings if none exist
 * - Seeds standard master vegetables if none exist
 * - Ensures single admin user 'raja' exists
 * - NEVER seeds demo customers, fake bills, or dummy payments in production
 */
const seedInitialData = async () => {
  try {
    // 1. Seed default shop settings if none exist
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      await Settings.create({
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
        paperSize: 'A6',
        logoUrl: '/cpn_logo.png',
        upiId: 'rajapandi688-1@okaxis',
      });
      console.log('[Seed] Default shop settings created.');
    }

    // 2. Ensure all approved wholesale vegetables exist in master catalog
    for (let i = 0; i < defaultVegetables.length; i++) {
      const item = defaultVegetables[i];
      const norm = item.name.toLowerCase().trim();
      const existing = await Vegetable.findOne({ normalizedName: norm });
      if (!existing) {
        await Vegetable.create({
          name: item.name,
          normalizedName: norm,
          tamilName: item.tamilName,
          defaultRate: item.defaultRate,
          unit: item.unit,
          isActive: true,
          sortOrder: i + 1,
        });
      }
    }

    // 3. Ensure single default admin user 'raja' with password 'raja' exists
    const rajaUser = await User.findOne({ username: 'raja' });
    if (!rajaUser) {
      await User.create({
        username: 'raja',
        password: 'raja',
        name: 'Raja',
        role: 'admin',
        isActive: true,
      });
      console.log('[Seed] Admin user "raja" created.');
    }

    // Remove obsolete 'admin' user if present to enforce single login
    await User.deleteMany({ username: 'admin' });
  } catch (err) {
    console.error('[Seed] Error seeding data:', err.message);
  }
};

/**
 * Development-only seeder for optional local testing
 * Must be explicitly called via 'npm run seed:dev'
 */
const seedDevelopmentDemoData = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SeedDev] BLOCKED: Cannot seed demo data in production environment!');
    return;
  }
  try {
    const custCount = await Customer.countDocuments();
    if (custCount === 0) {
      const sampleCustomers = [
        { name: 'Murugan Traders', tamilName: 'முருகன் டிரேடர்ஸ்', phone: '98421 12345', address: 'கடை எண் 14, காந்தி மார்க்கெட்', openingBalance: 12500, currentBalance: 12500 },
        { name: 'Selvam Stores', tamilName: 'செல்வம் ஸ்டோர்ஸ்', phone: '94432 54321', address: 'பழனி ரோடு, திண்டுக்கல்', openingBalance: 8400, currentBalance: 8400 },
        { name: 'Karthik Hotel & Canteen', tamilName: 'கார்த்திக் ஹோட்டல்', phone: '97901 98765', address: 'மெயின் ரோடு, திண்டுக்கல்', openingBalance: 0, currentBalance: 0 },
      ];
      for (const cust of sampleCustomers) {
        await Customer.create(cust);
      }
      console.log(`[SeedDev] Seeded ${sampleCustomers.length} demo customers.`);
    }
  } catch (err) {
    console.error('[SeedDev] Error:', err.message);
  }
};

module.exports = {
  seedInitialData,
  seedDevelopmentDemoData,
  defaultVegetables,
};
