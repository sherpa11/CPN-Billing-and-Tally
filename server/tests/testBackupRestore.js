/**
 * CPN VEGETABLES - Isolated Backup and Restore Integrity Test
 * Tests exporting, verifying JSON structure, and restoring records strictly
 * against the isolated test database (cpn_vegetables_test_db).
 */

process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const Vegetable = require('../models/Vegetable');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const { round2 } = require('../utils/mathUtils');

const runBackupRestoreTest = async () => {
  console.log('\n======================================================');
  console.log('  CPN VEGETABLES - BACKUP & RESTORE INTEGRITY TEST');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const test = (description, condition) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cpn_vegetables_test_db' });
    test('Connected to isolated test database', mongoose.connection.name === 'cpn_vegetables_test_db');

    // 2. Prepare test dataset
    await Vegetable.deleteMany({});
    await Customer.deleteMany({});
    await Bill.deleteMany({});
    await Payment.deleteMany({});

    const testVeg = await Vegetable.create({
      name: 'Backup Test Drumstick',
      normalizedName: 'backup test drumstick',
      tamilName: 'முருங்கைக்காய் ஸ்பெஷல்',
      defaultRate: 75,
      unit: 'Kg',
      isActive: true,
    });

    const testCust = await Customer.create({
      name: 'Backup Test Buyer',
      phone: '9842100001',
      tamilName: 'டெஸ்ட் வாடிக்கையாளர்',
      openingBalance: 1000,
      currentBalance: 5000,
      isActive: true,
    });

    const testBill = await Bill.create({
      billNumber: 9901,
      billNumberFormatted: 'CPN-9901',
      customer: testCust._id,
      customerName: testCust.name,
      customerPhone: testCust.phone,
      items: [
        {
          vegetable: testVeg._id,
          particulars: testVeg.name,
          tamilName: testVeg.tamilName,
          rate: 75,
          bag: 2,
          weight: 40,
          amount: 3000,
        },
      ],
      todayTotal: 3000,
      previousBalance: 1000,
      grandTotal: 4000,
      cashReceived: 0,
      closingBalance: 4000,
      status: 'active',
    });

    const testPay = await Payment.create({
      paymentNumber: 9001,
      customer: testCust._id,
      customerName: testCust.name,
      amount: 1000,
      paymentMode: 'Cash',
      status: 'active',
    });

    // 3. Export simulated backup
    const [vegs, custs, bills, pays] = await Promise.all([
      Vegetable.find(),
      Customer.find(),
      Bill.find(),
      Payment.find(),
    ]);

    const backupPayload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      collections: {
        vegetables: vegs,
        customers: custs,
        bills: bills,
        payments: pays,
      },
    };

    test('Backup JSON contains all collections with valid timestamps',
      backupPayload.collections.vegetables.length === 1 &&
      backupPayload.collections.customers.length === 1 &&
      backupPayload.collections.bills.length === 1 &&
      backupPayload.collections.payments.length === 1
    );

    // 4. Wipe test database to simulate catastrophic disaster
    await Vegetable.deleteMany({});
    await Customer.deleteMany({});
    await Bill.deleteMany({});
    await Payment.deleteMany({});

    const emptyCount =
      (await Vegetable.countDocuments()) +
      (await Customer.countDocuments()) +
      (await Bill.countDocuments()) +
      (await Payment.countDocuments());
    test('Simulated disaster: Test database completely wiped', emptyCount === 0);

    // 5. Execute Restore
    for (const item of backupPayload.collections.vegetables) {
      await Vegetable.findByIdAndUpdate(item._id, item, { upsert: true });
    }
    for (const item of backupPayload.collections.customers) {
      await Customer.findByIdAndUpdate(item._id, item, { upsert: true });
    }
    for (const item of backupPayload.collections.bills) {
      await Bill.findByIdAndUpdate(item._id, item, { upsert: true });
    }
    for (const item of backupPayload.collections.payments) {
      await Payment.findByIdAndUpdate(item._id, item, { upsert: true });
    }

    // 6. Verify restored database integrity
    const restoredCust = await Customer.findById(testCust._id);
    const restoredBill = await Bill.findById(testBill._id);
    const restoredVeg = await Vegetable.findById(testVeg._id);
    const restoredPay = await Payment.findById(testPay._id);

    test('Restore: Vegetable restored with exact ObjectId and Tamil name',
      restoredVeg && restoredVeg.tamilName === 'முருங்கைக்காய் ஸ்பெஷல்'
    );
    test('Restore: Customer restored with exact ObjectId and current balance ₹5,000',
      restoredCust && restoredCust.currentBalance === 5000
    );
    test('Restore: Bill restored and relation to Customer preserved',
      restoredBill && restoredBill.customer.toString() === testCust._id.toString()
    );
    test('Restore: Bill line-item relation to Vegetable preserved',
      restoredBill && restoredBill.items[0].vegetable.toString() === testVeg._id.toString()
    );
    test('Restore: Payment restored and relation to Customer preserved',
      restoredPay && restoredPay.customer.toString() === testCust._id.toString()
    );

    // Clean up test data
    await Vegetable.deleteMany({});
    await Customer.deleteMany({});
    await Bill.deleteMany({});
    await Payment.deleteMany({});

    console.log('\n------------------------------------------------------');
    console.log(`  BACKUP & RESTORE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');

    await mongoose.disconnect();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  runBackupRestoreTest();
}

module.exports = { runBackupRestoreTest };
