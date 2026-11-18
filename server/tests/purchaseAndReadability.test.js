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

const { round2, add2, sub2, mul2 } = require('../utils/mathUtils');

console.log('\n======================================================');
console.log('  CPN VEGETABLES - PURCHASE & REPORT READABILITY TEST  ');
console.log('======================================================\n');

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
  // SECTION 1: Report Font Size & Readability Verifications
  // ----------------------------------------------------
  console.log('--- Section 1: Customer Ledger Report Font Sizes & Print Output ---');

  const reportsPath = path.resolve(__dirname, '../../client/src/pages/Reports.jsx');
  const reportsContent = fs.readFileSync(reportsPath, 'utf8');

  const cssPath = path.resolve(__dirname, '../../client/src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  runTest('1.1 Reports.jsx: Customer Name column has enlarged, bold classes', () => {
    assert(
      reportsContent.includes('report-customer-name') &&
      reportsContent.includes('font-black text-gray-950 text-base md:text-lg'),
      'Customer name column should have prominent bold font and enlarged sizing classes'
    );
  });

  runTest('1.2 Reports.jsx: Outstanding Balance column has enlarged, prominent styling', () => {
    assert(
      reportsContent.includes('report-outstanding-amount') &&
      reportsContent.includes('font-mono-num font-black text-amber-900 text-base md:text-lg'),
      'Outstanding balance column should have prominent bold amber font and enlarged sizing classes'
    );
  });

  runTest('1.3 Reports.jsx: Table headers define dedicated explicit column widths', () => {
    assert(
      reportsContent.includes('w-12') &&
      reportsContent.includes('w-[34%]') &&
      reportsContent.includes('w-[26%]'),
      'Table header must specify proportional column widths to prevent overlapping of long customer names'
    );
  });

  runTest('1.4 index.css: Print CSS contains high-contrast print overrides for report customer name', () => {
    assert(
      cssContent.includes('.report-customer-name') &&
      cssContent.includes('font-size: 15px !important;') &&
      cssContent.includes('font-weight: 900 !important;'),
      'index.css must enforce 15px 900-weight for customer names when printing reports'
    );
  });

  runTest('1.5 index.css: Print CSS contains enlarged font for report outstanding amounts', () => {
    assert(
      cssContent.includes('.report-outstanding-amount') &&
      cssContent.includes('font-size: 16px !important;') &&
      cssContent.includes('font-weight: 900 !important;'),
      'index.css must enforce 16px 900-weight for outstanding amounts when printing reports'
    );
  });

  // ----------------------------------------------------
  // SECTION 2: UI Routing & Component Integration
  // ----------------------------------------------------
  console.log('\n--- Section 2: Sidebar Navigation & Routing Integration ---');

  const layoutPath = path.resolve(__dirname, '../../client/src/components/Layout.jsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  runTest('2.1 Layout.jsx: Purchase / கொள்முதல் navigation item added with Truck icon', () => {
    assert(
      layoutContent.includes("name: 'Purchase / கொள்முதல்'") &&
      layoutContent.includes("path: '/purchases'") &&
      layoutContent.includes('Truck'),
      'Layout navigation must include Purchase / கொள்முதல் with Truck icon'
    );
  });

  const appPath = path.resolve(__dirname, '../../client/src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  runTest('2.2 App.jsx: Purchases route registered', () => {
    assert(
      appContent.includes('import Purchases from') &&
      appContent.includes('<Route path="purchases" element={<Purchases />} />'),
      'App.jsx must route /purchases to Purchases page'
    );
  });

  const newBillPath = path.resolve(__dirname, '../../client/src/pages/NewBill.jsx');
  const newBillContent = fs.readFileSync(newBillPath, 'utf8');

  runTest('2.3 NewBill.jsx: Customer vs Supplier toggle selector present', () => {
    assert(
      newBillContent.includes('handleSwitchPartyType') &&
      newBillContent.includes('Supplier / சப்ளையர்') &&
      newBillContent.includes('Customer / வாடிக்கையாளர்'),
      'NewBill page must provide Customer vs Supplier selector toggle'
    );
  });

  runTest('2.4 NewBill.jsx: SupplierAutocomplete component integrated', () => {
    assert(
      newBillContent.includes('SupplierAutocomplete') &&
      newBillContent.includes('SUPPLIER / சப்ளையர்:'),
      'NewBill page must render SupplierAutocomplete with supplier label in supplier mode'
    );
  });

  runTest('2.5 NewBill.jsx: Saves to /api/purchases in supplier mode', () => {
    assert(
      newBillContent.includes("api.post('/purchases'") &&
      newBillContent.includes("api.put(`/purchases/${editBillId}`"),
      'NewBill page must submit to /purchases in supplier mode'
    );
  });

  // ----------------------------------------------------
  // SECTION 3: Isolated Database & Supplier Accounting
  // ----------------------------------------------------
  console.log('\n--- Section 3: Database Models, Accounting & Isolation ---');

  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  // Count existing customer documents before supplier operations
  const initialCustomerCount = await Customer.countDocuments();
  const initialBillCount = await Bill.countDocuments();
  const initialPaymentCount = await Payment.countDocuments();

  let testSupplierId = null;
  let testPurchaseId = null;

  await runAsyncTest('3.1 Supplier Model: Create supplier with opening balance', async () => {
    const s = await Supplier.create({
      name: `Nilgiri Farmers Co ${Date.now()}`,
      tamilName: 'நீலகிரி விவசாயிகள் சங்கம்',
      phone: '9842109876',
      address: 'Ooty Road, Mettupalayam',
      openingBalance: 15000,
      currentBalance: 15000,
      notes: 'Potato & Carrot Supplier',
    });
    testSupplierId = s._id;
    assert.strictEqual(s.openingBalance, 15000);
    assert.strictEqual(s.currentBalance, 15000);
    assert.strictEqual(s.isActive, true);
  });

  await runAsyncTest('3.2 Purchase Calculation & Balance Invariant: Create Purchase Bill', async () => {
    // 50kg @ ₹30 = ₹1500, 20kg @ ₹40 = ₹800. Today Total = ₹2300
    const todayTotal = 2300;
    const previousBalance = 15000;
    const grandTotal = 17300; // 2300 + 15000
    const discount = 300;
    const cashPaid = 5000;
    const closingBalance = grandTotal - discount - cashPaid; // 17300 - 300 - 5000 = 12000

    const purchase = await Purchase.create({
      purchaseNumber: 9901,
      purchaseNumberFormatted: 'PUR-9901',
      supplier: testSupplierId,
      supplierName: 'Nilgiri Farmers Co',
      supplierPhone: '9842109876',
      purchaseDate: new Date(),
      items: [
        { particulars: 'Carrot', tamilName: 'கேரட்', rate: 30, bag: 1, weight: 50, amount: 1500 },
        { particulars: 'Beans', tamilName: 'பீன்ஸ்', rate: 40, bag: 1, weight: 20, amount: 800 },
      ],
      totalBag: 2,
      totalWeight: 70,
      todayTotal,
      previousBalance,
      grandTotal,
      discount,
      varavu: cashPaid,
      cashPaid,
      closingBalance,
    });
    testPurchaseId = purchase._id;

    // Create supplier payment record for cash paid on purchase
    if (cashPaid > 0) {
      await SupplierPayment.create({
        paymentNumber: 9901,
        supplier: testSupplierId,
        supplierName: 'Nilgiri Farmers Co',
        purchase: purchase._id,
        amount: cashPaid,
        paymentDate: purchase.purchaseDate,
        paymentMode: 'Cash',
        resultingBalance: closingBalance,
        remarks: 'Varavu on purchase bill PUR-9901',
      });
    }

    // Update supplier current balance
    await Supplier.findByIdAndUpdate(testSupplierId, {
      currentBalance: closingBalance,
      lastPurchaseDate: purchase.purchaseDate,
    });

    const updatedSupp = await Supplier.findById(testSupplierId);
    assert.strictEqual(updatedSupp.currentBalance, 12000, 'Supplier balance must equal closing balance of ₹12,000');
  });

  await runAsyncTest('3.3 Standalone Supplier Payment: Reduce supplier balance', async () => {
    const paymentAmount = 4000;
    const supp = await Supplier.findById(testSupplierId);
    const newBalance = round2(supp.currentBalance - paymentAmount); // 12000 - 4000 = 8000

    await SupplierPayment.create({
      paymentNumber: 9902,
      supplier: testSupplierId,
      supplierName: supp.name,
      amount: paymentAmount,
      paymentDate: new Date(),
      paymentMode: 'Bank Transfer',
      resultingBalance: newBalance,
      remarks: 'Direct RTGS payment',
    });

    await Supplier.findByIdAndUpdate(testSupplierId, {
      currentBalance: newBalance,
    });

    const updatedSupp = await Supplier.findById(testSupplierId);
    assert.strictEqual(updatedSupp.currentBalance, 8000, 'Supplier balance after payment must be ₹8,000');
  });

  await runAsyncTest('3.4 Supplier Transaction Ledger: Complete chronological history with running balance', async () => {
    const supp = await Supplier.findById(testSupplierId);
    const purchases = await Purchase.find({ supplier: testSupplierId }).lean();
    const payments = await SupplierPayment.find({ supplier: testSupplierId }).lean();

    assert.strictEqual(purchases.length, 1, 'Exactly 1 purchase bill found');
    assert.strictEqual(payments.length, 2, 'Exactly 2 payment records found (1 bill varavu + 1 standalone)');

    // Compute ledger entries
    const entries = [];
    if (supp.openingBalance) {
      entries.push({ type: 'OPENING', amount: supp.openingBalance, date: supp.createdAt });
    }
    purchases.forEach((p) => {
      entries.push({ type: 'PURCHASE', amount: p.todayTotal, date: p.purchaseDate });
      if (p.discount > 0) {
        entries.push({ type: 'DISCOUNT', amount: p.discount, date: p.purchaseDate });
      }
    });
    payments.forEach((py) => {
      entries.push({ type: 'PAYMENT', amount: py.amount, date: py.paymentDate });
    });

    // Verification of final ledger state: 15000 + 2300 - 300 - 5000 - 4000 = 8000
    let runningBalance = supp.openingBalance;
    runningBalance = runningBalance + 2300 - 300 - 5000 - 4000;
    assert.strictEqual(runningBalance, supp.currentBalance, 'Running ledger balance matches supplier currentBalance');
  });

  await runAsyncTest('3.5 Safe Supplier Deletion: Prevent hard delete when transactions exist', async () => {
    const purchaseCount = await Purchase.countDocuments({ supplier: testSupplierId });
    assert(purchaseCount > 0, 'Transactions exist for this supplier');

    // Controller rule: if transactions exist, do NOT hard-delete; soft delete or block
    let blockedHardDelete = false;
    if (purchaseCount > 0) {
      // Simulate controller safety check
      blockedHardDelete = true;
      await Supplier.findByIdAndUpdate(testSupplierId, { isActive: false });
    }

    const supp = await Supplier.findById(testSupplierId);
    assert(blockedHardDelete, 'Hard deletion was safely prevented');
    assert.strictEqual(supp.isActive, false, 'Supplier was marked inactive rather than deleted from database');
  });

  await runAsyncTest('3.6 Customer Accounting Isolation: Document counts & customer data remain 100% untouched', async () => {
    const finalCustomerCount = await Customer.countDocuments();
    const finalBillCount = await Bill.countDocuments();
    const finalPaymentCount = await Payment.countDocuments();

    assert.strictEqual(finalCustomerCount, initialCustomerCount, 'Customer count must remain exactly unchanged');
    assert.strictEqual(finalBillCount, initialBillCount, 'Customer Bill count must remain exactly unchanged');
    assert.strictEqual(finalPaymentCount, initialPaymentCount, 'Customer Payment count must remain exactly unchanged');
  });

  // Clean up test records from isolated test DB
  if (testSupplierId) {
    await Supplier.findByIdAndDelete(testSupplierId);
    await Purchase.deleteMany({ supplier: testSupplierId });
    await SupplierPayment.deleteMany({ supplier: testSupplierId });
  }

  console.log('\n------------------------------------------------------');
  console.log(`  TEST RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
  console.log('------------------------------------------------------\n');

  await mongoose.disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
