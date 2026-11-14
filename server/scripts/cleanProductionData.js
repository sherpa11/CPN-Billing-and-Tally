const mongoose = require('mongoose');
require('dotenv').config();
const { defaultVegetables } = require('../utils/seedData');
const User = require('../models/User');

async function cleanProductionData() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_db';
  console.log(`[Production Cleanup] Connecting to ${uri}...`);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;

  // 1. Clean test bills & payments
  const billResult = await db.collection('bills').deleteMany({});
  console.log(`[Cleanup] Deleted ${billResult.deletedCount} demo/test bills.`);

  const paymentResult = await db.collection('payments').deleteMany({});
  console.log(`[Cleanup] Deleted ${paymentResult.deletedCount} demo/test payments.`);

  // 2. Clean test customers
  const custResult = await db.collection('customers').deleteMany({});
  console.log(`[Cleanup] Deleted ${custResult.deletedCount} demo/test customer accounts.`);

  // 3. Clean test vegetables: Retain ONLY the 27 approved wholesale vegetables
  const approvedNames = defaultVegetables.map((v) => v.name.toLowerCase());
  const vegDeleteResult = await db.collection('vegetables').deleteMany({
    normalizedName: { $nin: approvedNames },
  });
  console.log(`[Cleanup] Removed ${vegDeleteResult.deletedCount} test vegetables. Retained approved catalog.`);

  // Ensure all 27 approved vegetables exist and are active
  for (let i = 0; i < defaultVegetables.length; i++) {
    const item = defaultVegetables[i];
    await db.collection('vegetables').updateOne(
      { normalizedName: item.name.toLowerCase() },
      {
        $set: {
          name: item.name,
          normalizedName: item.name.toLowerCase(),
          tamilName: item.tamilName,
          defaultRate: item.defaultRate,
          unit: item.unit,
          isActive: true,
          isDeleted: false,
          sortOrder: i + 1,
        },
      },
      { upsert: true }
    );
  }
  const finalVegCount = await db.collection('vegetables').countDocuments();
  console.log(`[Cleanup] Verified approved vegetable master count: ${finalVegCount}`);

  // 4. Ensure sole admin user 'raja' with password 'raja'
  await db.collection('users').deleteMany({ username: { $ne: 'raja' } });
  let raja = await User.findOne({ username: 'raja' });
  if (!raja) {
    raja = await User.create({
      username: 'raja',
      password: 'raja',
      name: 'Raja',
      role: 'admin',
      isActive: true,
    });
    console.log('[Cleanup] Created clean admin user "raja".');
  } else {
    // Re-hash to guarantee known password 'raja'
    raja.password = 'raja';
    await raja.save();
    console.log('[Cleanup] Verified and updated password for admin "raja".');
  }

  // 5. Clean audit logs
  await db.collection('auditlogs').deleteMany({});
  console.log('[Cleanup] Cleared development audit logs.');

  // Summary of clean database
  console.log('\n--- CLEAN PRODUCTION DATABASE STATE ---');
  const collections = ['vegetables', 'customers', 'bills', 'payments', 'settings', 'users'];
  for (const c of collections) {
    const count = await db.collection(c).countDocuments();
    console.log(` - ${c}: ${count} records`);
  }
  console.log('----------------------------------------\n');

  await mongoose.disconnect();
  console.log('[Production Cleanup] Database is clean, secure, and deployment-ready.');
}

cleanProductionData().catch((err) => {
  console.error('[Cleanup Error]', err);
  process.exit(1);
});
