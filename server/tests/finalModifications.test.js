/**
 * finalModifications.test.js
 *
 * Automated test suite covering the 3 modifications:
 * 1. Customer Outstanding Report (6 columns: Customer Name, Old Balance, Latest Bill Total, Total Outstanding, Paid, New Balance)
 * 2. Add 10 Empty Item Rows in One Click (NewBill.jsx)
 * 3. Report Direct Download Options (PDF & CSV direct download in Reports.jsx)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const { getCustomerOutstandingReport } = require('../controllers/reportController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n==================================================================');
  console.log('  CPN VEGETABLES - FINAL MODIFICATIONS AUTOMATED TEST SUITE        ');
  console.log('==================================================================\n');

  // Connect to test DB
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  // Pre-cleanup in case of previous run abort
  await Customer.deleteMany({ name: /Test Customer Alpha|Test Customer Beta/ });

  console.log('--- Section 1: Customer Outstanding 6-Column Calculation & API ---');

  // Setup test data in DB
  const testCustomerWithBill = await Customer.create({
    name: 'Test Customer Alpha',
    tamilName: 'ஆல்பா',
    phone: '9876543210',
    openingBalance: 1000,
    currentBalance: 3500, // Expected newBalance
    isDeleted: false,
  });

  // Bill: previousBalance = 2000, todayTotal = 4000, varavu = 2500
  // totalOutstanding = 2000 + 4000 = 6000
  // newBalance = 3500
  const testBill = await Bill.create({
    billNumber: 9901,
    billNumberFormatted: 'CPN-9901',
    customer: testCustomerWithBill._id,
    customerName: testCustomerWithBill.name,
    customerTamilName: testCustomerWithBill.tamilName,
    billDate: new Date('2026-11-20'),
    items: [
      { particulars: 'Tomato', particularsTamil: 'தக்காளி', bag: 2, weight: 100, rate: 40, amount: 4000 },
    ],
    totalBag: 2,
    totalWeight: 100,
    todayTotal: 4000,
    previousBalance: 2000,
    totalAmount: 6000,
    discount: 0,
    varavu: 2500,
    cashReceived: 2500,
    closingBalance: 3500,
    status: 'active',
  });

  const testCustomerNoBill = await Customer.create({
    name: 'Test Customer Beta (No Bill)',
    tamilName: 'பீட்டா',
    phone: '9876543211',
    openingBalance: 5000,
    currentBalance: 4000, // After ₹1,000 payment
    isDeleted: false,
  });

  await Payment.create({
    customer: testCustomerNoBill._id,
    customerName: testCustomerNoBill.name,
    amount: 1000,
    paymentDate: new Date('2026-11-20'),
    type: 'cash',
    status: 'active',
  });

  await itAsync('1.1 getCustomerOutstandingReport computes exact 6 columns for customer with bill', async () => {
    let responseData = null;
    const req = { query: { search: 'Test Customer Alpha' } };
    const res = {
      json: (data) => {
        responseData = data;
      },
      status: () => res,
    };

    await getCustomerOutstandingReport(req, res);

    assert(responseData, 'Response data must be returned');
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.totalCustomers, 1);

    const row = responseData.data[0];
    assert.strictEqual(row.name, 'Test Customer Alpha');
    assert.strictEqual(row.oldBalance, 2000, 'Old Balance should equal bill previousBalance');
    assert.strictEqual(row.latestBillTotal, 4000, 'Latest Bill Total should equal bill todayTotal');
    assert.strictEqual(row.totalOutstanding, 6000, 'Total Outstanding = Old Balance + Latest Bill Total (2000 + 4000)');
    assert.strictEqual(row.paid, 2500, 'Paid should equal bill varavu/cashReceived');
    assert.strictEqual(row.newBalance, 3500, 'New Balance should match authoritative ledger currentBalance (3500)');
  });

  await itAsync('1.2 getCustomerOutstandingReport handles customer with no bills cleanly (0.00 bill total)', async () => {
    let responseData = null;
    const req = { query: { search: 'Test Customer Beta' } };
    const res = {
      json: (data) => {
        responseData = data;
      },
      status: () => res,
    };

    await getCustomerOutstandingReport(req, res);

    assert(responseData, 'Response data must be returned');
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.totalCustomers, 1);

    const row = responseData.data[0];
    assert.strictEqual(row.name, 'Test Customer Beta (No Bill)');
    assert.strictEqual(row.latestBillTotal, 0, 'Latest Bill Total must be 0 for customer without bills');
    assert.strictEqual(row.paid, 1000, 'Paid must reflect standalone payments');
    assert.strictEqual(row.newBalance, 4000, 'New Balance must match customer current balance');
    assert.strictEqual(row.totalOutstanding, 5000, 'Total Outstanding must equal oldBalance (5000)');
  });

  await itAsync('1.3 getCustomerOutstandingReport computes accurate summary totals across all 5 financial columns', async () => {
    let responseData = null;
    const req = { query: {} };
    const res = {
      json: (data) => {
        responseData = data;
      },
      status: () => res,
    };

    await getCustomerOutstandingReport(req, res);

    assert(responseData, 'Response data must be returned');
    assert(responseData.totalOldBalance !== undefined, 'totalOldBalance must be present in response');
    assert(responseData.totalLatestBillTotal !== undefined, 'totalLatestBillTotal must be present in response');
    assert(responseData.totalOutstanding !== undefined, 'totalOutstanding must be present in response');
    assert(responseData.totalPaid !== undefined, 'totalPaid must be present in response');
    assert(responseData.totalNewBalance !== undefined, 'totalNewBalance must be present in response');
  });

  console.log('\n--- Section 2: Reports.jsx 6-Column UI & Elimination of Tamil/Phone Columns ---');

  const reportsJsxPath = path.join(__dirname, '../../client/src/pages/Reports.jsx');
  const reportsSource = fs.readFileSync(reportsJsxPath, 'utf8');

  it('2.1 Reports.jsx table header has exact 6 columns in order: Customer Name, Old Balance, Latest Bill Total, Total Outstanding, Paid, New Balance', () => {
    assert(reportsSource.includes('Customer Name'), 'Table header must include Customer Name');
    assert(reportsSource.includes('Old Balance (₹)'), 'Table header must include Old Balance (₹)');
    assert(reportsSource.includes('Latest Bill Total (₹)'), 'Table header must include Latest Bill Total (₹)');
    assert(reportsSource.includes('Total Outstanding (₹)'), 'Table header must include Total Outstanding (₹)');
    assert(reportsSource.includes('Paid (₹)'), 'Table header must include Paid (₹)');
    assert(reportsSource.includes('New Balance (₹)'), 'Table header must include New Balance (₹)');

    // Check order in th elements
    const customerIdx = reportsSource.indexOf('Customer Name');
    const oldBalIdx = reportsSource.indexOf('Old Balance (₹)');
    const latestBillIdx = reportsSource.indexOf('Latest Bill Total (₹)');
    const totalOutIdx = reportsSource.indexOf('Total Outstanding (₹)');
    const paidIdx = reportsSource.indexOf('Paid (₹)');
    const newBalIdx = reportsSource.indexOf('New Balance (₹)');

    assert(customerIdx < oldBalIdx, 'Customer Name must precede Old Balance');
    assert(oldBalIdx < latestBillIdx, 'Old Balance must precede Latest Bill Total');
    assert(latestBillIdx < totalOutIdx, 'Latest Bill Total must precede Total Outstanding');
    assert(totalOutIdx < paidIdx, 'Total Outstanding must precede Paid');
    assert(paidIdx < newBalIdx, 'Paid must precede New Balance');
  });

  it('2.2 Reports.jsx removes Tamil Name and Phone Number columns from Customer Outstanding table', () => {
    assert(!reportsSource.includes('report-col-tamil'), 'Tamil Name column class must be removed');
    assert(!reportsSource.includes('report-col-phone'), 'Phone Number column class must be removed');
    assert(!reportsSource.includes('<th>Tamil Name</th>'), 'Tamil Name table header must not exist');
    assert(!reportsSource.includes('<th>Mobile</th>'), 'Mobile table header must not exist');
  });

  it('2.3 Reports.jsx includes summary totals row for all new columns in footer', () => {
    assert(reportsSource.includes('sumOldBalance'), 'Footer must sum Old Balance');
    assert(reportsSource.includes('sumLatestBillTotal'), 'Footer must sum Latest Bill Total');
    assert(reportsSource.includes('sumTotalOutstanding'), 'Footer must sum Total Outstanding');
    assert(reportsSource.includes('sumPaid'), 'Footer must sum Paid');
    assert(reportsSource.includes('sumNewBalance'), 'Footer must sum New Balance');
  });

  console.log('\n--- Section 3: Add 10 Empty Rows in NewBill.jsx ---');

  const newBillJsxPath = path.join(__dirname, '../../client/src/pages/NewBill.jsx');
  const newBillSource = fs.readFileSync(newBillJsxPath, 'utf8');

  it('3.1 handleAddRow in NewBill.jsx appends exactly 10 empty rows at once', () => {
    assert(newBillSource.includes('Array.from({ length: 10 }, createEmptyRow)'), 'handleAddRow must append 10 createEmptyRow items');
  });

  console.log('\n--- Section 4: Reports Direct Download (PDF & CSV) Options ---');

  it('4.1 Reports.jsx renders Download PDF and Download CSV buttons beside Print Report', () => {
    assert(reportsSource.includes('handleDownloadPdf'), 'handleDownloadPdf function must exist');
    assert(reportsSource.includes('handleDownloadCsv'), 'handleDownloadCsv function must exist');
    assert(reportsSource.includes('Download PDF'), 'UI must contain Download PDF button');
    assert(reportsSource.includes('Download CSV'), 'UI must contain Download CSV button');
    assert(reportsSource.includes('Print Report'), 'Print Report button must be retained');
  });

  it('4.2 handleDownloadPdf renders multi-page A4 landscape pages with non-blank verification', () => {
    assert(reportsSource.includes('toPng'), 'toPng from html-to-image must be used for rendering');
    assert(reportsSource.includes('jsPDF'), 'jsPDF must be instantiated for direct client PDF creation');
    assert(reportsSource.includes("pdf.save("), 'pdf.save must be called to download file directly');
    assert(reportsSource.includes('CPN_Customer_Outstanding_'), 'Filename format must match CPN_Customer_Outstanding_YYYY-MM-DD.pdf');
    assert(reportsSource.includes('verifyNonBlank'), 'verifyNonBlank helper must be present to guarantee no blank PDFs');
    assert(reportsSource.includes('chunkRows'), 'chunkRows helper must be present to paginate rows cleanly');
  });

  console.log('\n--- Section 5: Print Layout & Clipping Fixes ---');

  const cssPath = path.join(__dirname, '../../client/src/index.css');
  const cssSource = fs.readFileSync(cssPath, 'utf8');

  it('5.1 Reports.jsx resets scrollLeft and injects A4 landscape @page rule before printing', () => {
    assert(reportsSource.includes('el.scrollLeft = 0'), 'handlePrintReport must reset container scrollLeft');
    assert(reportsSource.includes('A4 landscape'), 'Reports.jsx must inject A4 landscape rule for printing');
  });

  it('5.2 index.css enforces unclipped containers and exact 100% table layout for report print', () => {
    assert(cssSource.includes('body.print-report-active main'), 'main must have print unclip rule');
    assert(cssSource.includes('overflow: visible !important;'), 'Containers must force overflow: visible');
    assert(cssSource.includes('table-layout: fixed !important;'), 'Table must enforce fixed layout');
    assert(cssSource.includes('display: table-header-group !important;'), 'thead must repeat on every page');
  });

  // Clean up test records
  await Customer.deleteMany({ _id: { $in: [testCustomerWithBill._id, testCustomerNoBill._id] } });
  await Bill.deleteMany({ _id: testBill._id });
  await Payment.deleteMany({ customer: testCustomerNoBill._id });

  console.log('\n==================================================================');
  console.log(`  TEST RESULTS: ${passed} / ${passed + failed} PASSED`);
  if (failed > 0) {
    console.error(`  FAILURE: ${failed} tests failed!`);
    process.exit(1);
  } else {
    console.log('  ALL TESTS PASSED SUCCESSFULLY!');
  }
  console.log('==================================================================\n');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unhandled test runner error:', err);
    process.exit(1);
  });
