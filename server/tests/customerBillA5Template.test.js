const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');

console.log('\n==================================================================');
console.log('  CPN VEGETABLES - CUSTOMER BILL A5 TEMPLATE TEST SUITE           ');
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
  // SECTION 1: Template Asset Verification
  // ----------------------------------------------------
  console.log('--- Section 1: Template Asset Verification ---');

  const supplierTemplatePath = path.resolve(__dirname, '../../client/public/cpn_supplier_bill_template.jpg');
  const customerTemplatePath = path.resolve(__dirname, '../../client/public/cpn_blank_bill_template.jpg');
  const billPrintTemplatePath = path.resolve(__dirname, '../../client/src/components/BillPrintTemplate.jsx');

  runTest('1.1 cpn_supplier_bill_template.jpg exists and is substantial', () => {
    assert.ok(fs.existsSync(supplierTemplatePath), 'Supplier template must exist');
    const stats = fs.statSync(supplierTemplatePath);
    assert.ok(stats.size > 50000, `Supplier template size (${stats.size}) must be > 50KB`);
  });

  runTest('1.2 cpn_blank_bill_template.jpg matches the approved exact supplier bill template', () => {
    assert.ok(fs.existsSync(customerTemplatePath), 'Customer blank bill template must exist');
    const suppBuf = fs.readFileSync(supplierTemplatePath);
    const custBuf = fs.readFileSync(customerTemplatePath);
    assert.strictEqual(
      suppBuf.length,
      custBuf.length,
      'Customer template must have exact identical length as approved supplier template'
    );
    assert.ok(
      suppBuf.equals(custBuf),
      'Customer template binary must exactly match approved supplier template'
    );
  });

  // ----------------------------------------------------
  // SECTION 2: BillPrintTemplate Layout & Coordinate Verification
  // ----------------------------------------------------
  console.log('\n--- Section 2: BillPrintTemplate Layout & Alignment ---');

  const templateContent = fs.readFileSync(billPrintTemplatePath, 'utf8');

  runTest('2.1 BillPrintTemplate.jsx enforces A5 portrait dimensions (148mm × 210mm) for all bills', () => {
    assert.ok(templateContent.includes("width: '148mm'"), 'Must enforce 148mm width');
    assert.ok(templateContent.includes("maxWidth: '148mm'"), 'Must enforce 148mm maxWidth');
    assert.ok(templateContent.includes("height: '210mm'"), 'Must enforce 210mm height');
    assert.ok(templateContent.includes("maxHeight: '210mm'"), 'Must enforce 210mm maxHeight');
  });

  runTest('2.2 Customer bills use the approved A5 table layout coordinates (tableTop: 29.8%)', () => {
    assert.ok(templateContent.includes('const tableTop = 29.8;'), 'tableTop must be 29.8%');
  });

  runTest('2.3 Customer bills map customer name strictly without supplier bleed', () => {
    assert.ok(
      templateContent.includes("partyName = isSupplierBill") &&
      templateContent.includes("bill.customerName || bill.customer?.name || ''"),
      'Customer bills must resolve customer name strictly'
    );
  });

  runTest('2.4 Customer bills position previous balance date in the pre-printed date slot', () => {
    assert.ok(
      templateContent.includes("left: '46.5%'") &&
      templateContent.includes("top: '78.81%'") &&
      templateContent.includes("width: '16.0%'"),
      'Previous balance date must be positioned in the date slot (46.5%, 78.81%)'
    );
  });

  runTest('2.5 Summary fields: Today total, Previous balance, Grand total, Varavu and Closing balance aligned', () => {
    assert.ok(templateContent.includes("top: '76.17%'"), 'Row 1 Today total at 76.17%');
    assert.ok(templateContent.includes("top: '78.81%'"), 'Row 2 Previous balance at 78.81%');
    assert.ok(templateContent.includes("top: '81.84%'"), 'Row 3 Grand total at 81.84%');
    assert.ok(templateContent.includes("top: '85.16%'"), 'Row 4 Varavu at 85.16%');
    assert.ok(templateContent.includes("top: '88.67%'"), 'Row 5 Closing balance at 88.67%');
  });

  runTest('2.6 Multi-page continuation block and footer page indicators', () => {
    assert.ok(templateContent.includes('தொடர்ச்சி அடுத்த பக்கம்'), 'Must include Tamil continuation banner');
    assert.ok(templateContent.includes('பக்கம் {page.pageNumber} / {page.totalPages}'), 'Must display page numbers');
  });

  // ----------------------------------------------------
  // SECTION 3: Live Database & Accounting Validations
  // ----------------------------------------------------
  console.log('\n--- Section 3: Live Database & Customer Accounting Isolation ---');

  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  // Initial counts
  const initialSupplierCount = await Supplier.countDocuments();
  const initialPurchaseCount = await Purchase.countDocuments();

  // 1. Create a customer with previous balance
  const testCustomer = await Customer.create({
    name: `Test Buyer ${Date.now()}`,
    tamilName: 'டெஸ்ட் வாடிக்கையாளர்',
    phone: '9876501234',
    openingBalance: 5000,
    currentBalance: 5000,
  });

  // 2. Create customer bill with 10 vegetables, discount, and cash received
  const items10 = [
    { particulars: 'Tomato', tamilName: 'தக்காளி', rate: 40, bag: 1, weight: 15, amount: 600 },
    { particulars: 'Beans', tamilName: 'பீன்ஸ்', rate: 120, bag: 0, weight: 5, amount: 600 },
    { particulars: 'Soya', tamilName: 'சோயா பீன்ஸ்', rate: 120, bag: 0, weight: 5, amount: 600 },
    { particulars: 'Peas', tamilName: 'பட்டாணி', rate: 120, bag: 0, weight: 5, amount: 600 },
    { particulars: 'Knol Khol', tamilName: 'நூல்கோல்', rate: 45, bag: 0, weight: 8, amount: 360 },
    { particulars: 'Capsicum', tamilName: 'குடைமிளகாய்', rate: 80, bag: 0, weight: 6, amount: 480 },
    { particulars: 'Carrot', tamilName: 'கேரட்', rate: 28, bag: 1, weight: 20, amount: 560 },
    { particulars: 'Bitter Gourd', tamilName: 'பாகற்காய்', rate: 65, bag: 0, weight: 5, amount: 325 },
    { particulars: 'Broad Beans', tamilName: 'அவரை', rate: 100, bag: 0, weight: 5, amount: 500 },
    { particulars: 'Radish', tamilName: 'முள்ளங்கி', rate: 30, bag: 0, weight: 10, amount: 300 },
  ];

  // Today total = 600+600+600+600+360+480+560+325+500+300 = 4925
  const todayTotal = 4925;
  const prevBalance = 5000;
  const grandTotal = todayTotal + prevBalance; // 9925
  const discount = 225;
  const varavu = 4700;
  const closingBal = grandTotal - discount - varavu; // 9925 - 225 - 4700 = 5000

  const testBill = await Bill.create({
    billNumber: 9988,
    billNumberFormatted: 'CPN-9988',
    customer: testCustomer._id,
    customerName: testCustomer.name,
    customerPhone: testCustomer.phone,
    billDate: new Date(),
    items: items10,
    totalBag: 2,
    totalWeight: 79,
    todayTotal,
    grandTotal,
    previousBalance: prevBalance,
    previousBalanceDate: new Date('2026-11-18'),
    discount,
    varavu,
    cashReceived: varavu,
    closingBalance: closingBal,
    status: 'active',
  });

  await runAsyncTest('3.1 Customer Bill: Accurate 10-item summary and balance math', async () => {
    assert.strictEqual(testBill.items.length, 10, 'Bill must contain 10 items');
    assert.strictEqual(testBill.todayTotal, 4925, 'Today total must be 4925');
    assert.strictEqual(testBill.grandTotal, 9925, 'Grand total must be 9925');
    assert.strictEqual(testBill.discount, 225, 'Discount must be 225');
    assert.strictEqual(testBill.varavu, 4700, 'Varavu must be 4700');
    assert.strictEqual(testBill.closingBalance, 5000, 'Closing balance must be 5000');
  });

  await runAsyncTest('3.2 Customer Accounting Invariant: Closing balance = Total - Discount - Varavu', async () => {
    const computed = testBill.grandTotal - testBill.discount - testBill.varavu;
    assert.strictEqual(testBill.closingBalance, computed, 'Closing balance invariant verified');
  });

  await runAsyncTest('3.3 Supplier Isolation: Supplier counts and records remain 100% untouched', async () => {
    const finalSupplierCount = await Supplier.countDocuments();
    const finalPurchaseCount = await Purchase.countDocuments();
    assert.strictEqual(finalSupplierCount, initialSupplierCount, 'Supplier count must not change');
    assert.strictEqual(finalPurchaseCount, initialPurchaseCount, 'Purchase count must not change');
  });

  // Cleanup test documents
  await Bill.deleteOne({ _id: testBill._id });
  await Customer.deleteOne({ _id: testCustomer._id });

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
