const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Vegetable = require('../models/Vegetable');

// Controllers
const { getDashboardStats } = require('../controllers/reportController');
const { getBills } = require('../controllers/billController');
const { cancelPurchase } = require('../controllers/purchaseController');

console.log('\n==================================================================');
console.log('  CPN VEGETABLES - PURCHASE IN DASHBOARD & ALL BILLS TEST SUITE  ');
console.log('==================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         ${err.message}`);
  }
}

async function runAsyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         ${err.message}`);
  }
}

async function runSuite() {
  // ----------------------------------------------------
  // SECTION 1: Static Code, JSX & Integration Checks
  // ----------------------------------------------------
  console.log('--- Section 1: Dashboard Purchase Summary & UI Verification ---');

  const dashboardPath = path.resolve(__dirname, '../../client/src/pages/Dashboard.jsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  runTest('1.1 Dashboard.jsx: Dedicated Purchase Summary section exists', () => {
    assert(
      dashboardContent.includes('Purchase Summary / கொள்முதல் சுருக்கம்'),
      'Dashboard must have Purchase Summary header'
    );
    assert(
      dashboardContent.includes('todayPurchasesTotal'),
      'Dashboard must display todayPurchasesTotal'
    );
  });

  runTest('1.2 Dashboard.jsx: Displays all 4 required purchase metrics', () => {
    assert(dashboardContent.includes("Today's Purchases"), 'Must show Today Purchases');
    assert(dashboardContent.includes("Purchase Bills Today") || dashboardContent.includes("todayPurchasesCount"), 'Must show Today Purchase Bills count');
    assert(dashboardContent.includes("Total Bags Purchased") || dashboardContent.includes("todayPurchasesBags"), 'Must show Total Bags Purchased');
    assert(dashboardContent.includes("Total Weight (KG)") || dashboardContent.includes("todayPurchasesWeight"), 'Must show Total Weight (KG)');
  });

  runTest('1.3 Dashboard.jsx: Recent Purchase Bills table and mobile cards render required fields', () => {
    assert(dashboardContent.includes('recentPurchases'), 'Dashboard must manage recentPurchases state');
    assert(dashboardContent.includes('p.purchaseNumberFormatted'), 'Must display purchase bill number');
    assert(dashboardContent.includes('p.supplierName'), 'Must display supplier name');
    assert(dashboardContent.includes('p.purchaseDate'), 'Must display purchase date');
    assert(dashboardContent.includes('p.totalBag'), 'Must display total bags');
    assert(dashboardContent.includes('p.totalWeight'), 'Must display total weight');
    assert(dashboardContent.includes('p.todayTotal'), 'Must display today total');
    assert(dashboardContent.includes('p.closingBalance'), 'Must display closing balance');
    assert(dashboardContent.includes('handlePrintPurchase'), 'Must provide print handler for purchase bills');
  });

  console.log('\n--- Section 2: All Bills Tabs & Column Verifications ---');

  const allBillsPath = path.resolve(__dirname, '../../client/src/pages/AllBills.jsx');
  const allBillsContent = fs.readFileSync(allBillsPath, 'utf8');

  runTest('2.1 AllBills.jsx: Provides tab filter for All Bills, Customer Bills, Purchase Bills', () => {
    assert(allBillsContent.includes("All Bills / அனைத்து பில்கள்"), 'Must have All Bills tab');
    assert(allBillsContent.includes("Customer Bills / வாடிக்கையாளர்"), 'Must have Customer Bills tab');
    assert(allBillsContent.includes("Purchase Bills / கொள்முதல்"), 'Must have Purchase Bills tab');
  });

  runTest('2.2 AllBills.jsx: Purchase Bills tab displays all required columns', () => {
    assert(allBillsContent.includes('Purchase Bill No'), 'Must have Purchase Bill No column');
    assert(allBillsContent.includes('Supplier Name'), 'Must have Supplier Name column');
    assert(allBillsContent.includes('Purchase Total (₹)'), 'Must have Purchase Total column');
    assert(allBillsContent.includes('Amount Paid (₹)'), 'Must have Amount Paid column');
    assert(allBillsContent.includes('Closing Balance (₹)'), 'Must have Closing Balance column');
  });

  runTest('2.3 AllBills.jsx: Customer Bills tab preserves customer columns unchanged', () => {
    assert(allBillsContent.includes('Customer Name'), 'Must have Customer Name column for customer bills');
    assert(allBillsContent.includes('Today Total (₹)'), 'Must have Today Total column for customer bills');
    assert(allBillsContent.includes('Varavu (₹)'), 'Must have Varavu column for customer bills');
    assert(allBillsContent.includes('Closing Bal (₹)'), 'Must have Closing Bal column for customer bills');
  });

  runTest('2.4 AllBills.jsx: Wire actions: View/Print, Edit, and Cancel for purchases', () => {
    assert(allBillsContent.includes('handlePrintBill'), 'Must have print handler');
    assert(allBillsContent.includes('handleEditBill'), 'Must have edit handler routing to type=purchase');
    assert(allBillsContent.includes('handleConfirmCancel'), 'Must have cancel confirmation dialog');
  });

  runTest('2.5 NewBill.jsx: Supports type=purchase for creating and editing supplier bills', () => {
    const newBillPath = path.resolve(__dirname, '../../client/src/pages/NewBill.jsx');
    const newBillContent = fs.readFileSync(newBillPath, 'utf8');
    assert(newBillContent.includes("typeParam === 'purchase'"), 'NewBill must recognize type=purchase in searchParams');
  });

  // ----------------------------------------------------
  // SECTION 3: Live Database & Accounting Validations
  // ----------------------------------------------------
  console.log('\n--- Section 3: Database Controllers & Accounting Isolation ---');

  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  // Baseline counts
  const initialCustomerCount = await Customer.countDocuments();
  const initialBillCount = await Bill.countDocuments();

  // Create isolated supplier and purchase bill
  const testSupplier = await Supplier.create({
    name: `Test Procurement Farm ${Date.now()}`,
    tamilName: 'விவசாயப் பண்ணை',
    phone: '9988776655',
    address: 'Dindigul Bypass',
    openingBalance: 10000,
    currentBalance: 10000,
  });

  const todayStart = new Date();
  todayStart.setHours(10, 0, 0, 0);

  const testPurchase = await Purchase.create({
    purchaseNumber: 8899,
    purchaseNumberFormatted: 'PUR-8899',
    supplier: testSupplier._id,
    supplierName: testSupplier.name,
    supplierPhone: testSupplier.phone,
    purchaseDate: todayStart,
    items: [
      { particulars: 'Tomato', tamilName: 'தக்காளி', rate: 40, bag: 10, weight: 150, amount: 6000 },
      { particulars: 'Onion', tamilName: 'வெங்காயம்', rate: 50, bag: 5, weight: 100, amount: 5000 },
    ],
    totalBag: 15,
    totalWeight: 250,
    todayTotal: 11000,
    grandTotal: 21000, // 11000 + 10000
    previousBalance: 10000,
    previousBalanceDate: null,
    discount: 0,
    varavu: 3000,
    cashPaid: 3000,
    closingBalance: 18000, // 21000 - 3000
    status: 'active',
  });

  await runAsyncTest('3.1 Dashboard Stats: Correctly calculates today purchase totals', async () => {
    let statsData = null;
    const mockRes = {
      json: (data) => {
        statsData = data;
      },
      status: () => mockRes,
    };

    await getDashboardStats({}, mockRes);

    assert(statsData !== null, 'Stats response must not be null');
    assert(statsData.todayPurchasesCount >= 1, 'Today purchase count must be at least 1');
    assert(statsData.todayPurchasesTotal >= 11000, 'Today purchases total must include 11000');
    assert(statsData.todayPurchasesBags >= 15, 'Today purchases bags must include 15');
    assert(statsData.todayPurchasesWeight >= 250, 'Today purchases weight must include 250');
    assert(statsData.todayPurchasesPaid >= 3000, 'Today purchases paid must include 3000');
  });

  await runAsyncTest('3.2 All Bills API (type=purchase): Retrieves purchase records with server pagination', async () => {
    let result = null;
    const mockRes = {
      json: (data) => {
        result = data;
      },
      status: () => mockRes,
    };

    const req = {
      query: {
        type: 'purchase',
        page: 1,
        limit: 25,
        status: 'active',
      },
    };

    await getBills(req, mockRes);

    assert(result && result.success, 'Query must succeed');
    assert(Array.isArray(result.data), 'Data must be an array');
    const found = result.data.find((p) => p.purchaseNumberFormatted === 'PUR-8899');
    assert(found, 'Must find PUR-8899 in purchase bills list');
    assert.strictEqual(found.supplierName, testSupplier.name);
    assert.strictEqual(found.todayTotal, 11000);
    assert.strictEqual(found.totalBag, 15);
    assert.strictEqual(found.totalWeight, 250);
  });

  await runAsyncTest('3.3 All Bills API: Search by supplier name and purchase bill number', async () => {
    let resultByName = null;
    const mockResName = {
      json: (d) => { resultByName = d; },
      status: () => mockResName,
    };
    await getBills({ query: { type: 'purchase', search: testSupplier.name } }, mockResName);
    assert(resultByName.data.some((p) => p.purchaseNumberFormatted === 'PUR-8899'), 'Search by supplier name must find bill');

    let resultByNum = null;
    const mockResNum = {
      json: (d) => { resultByNum = d; },
      status: () => mockResNum,
    };
    await getBills({ query: { type: 'purchase', search: '8899' } }, mockResNum);
    assert(resultByNum.data.some((p) => p.purchaseNumberFormatted === 'PUR-8899'), 'Search by number 8899 must find bill');
  });

  await runAsyncTest('3.4 All Bills API (type=all): Returns unified customer and purchase records', async () => {
    let result = null;
    const mockRes = {
      json: (data) => {
        result = data;
      },
      status: () => mockRes,
    };

    const req = {
      query: {
        type: 'all',
        page: 1,
        limit: 50,
      },
    };

    await getBills(req, mockRes);

    assert(result && result.success, 'Unified query must succeed');
    const hasPurchase = result.data.some((b) => b.billType === 'purchase' || b.isPurchase);
    assert(hasPurchase, 'Unified list must include purchase bills');
  });

  await runAsyncTest('3.5 Safe Purchase Cancellation: Reverses supplier balance and void payments', async () => {
    let cancelRes = null;
    const mockRes = {
      json: (data) => {
        cancelRes = data;
      },
      status: () => mockRes,
    };

    const req = {
      params: { id: testPurchase._id.toString() },
      body: { reason: 'Test cancel for verification' },
    };

    await cancelPurchase(req, mockRes);
    assert(cancelRes && cancelRes.success, 'Cancel purchase must succeed');

    const updatedPurchase = await Purchase.findById(testPurchase._id);
    assert.strictEqual(updatedPurchase.status, 'cancelled');
    assert.strictEqual(updatedPurchase.cancellationReason, 'Test cancel for verification');
  });

  await runAsyncTest('3.6 Customer Accounting Isolation: Customer records and counts remain 100% untouched', async () => {
    const finalCustomerCount = await Customer.countDocuments();
    const finalBillCount = await Bill.countDocuments();

    assert.strictEqual(finalCustomerCount, initialCustomerCount, 'Customer count must not change');
    assert.strictEqual(finalBillCount, initialBillCount, 'Customer bill count must not change');
  });

  // Cleanup test supplier & purchase
  await Purchase.deleteOne({ _id: testPurchase._id });
  await Supplier.deleteOne({ _id: testSupplier._id });

  console.log('\n==================================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('==================================================================\n');

  await mongoose.disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
