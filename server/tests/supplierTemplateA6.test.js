const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n==================================================================');
console.log('  CPN VEGETABLES - SUPPLIER BILL EXACT IMAGE & A6 TEMPLATE TEST   ');
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

const supplierImgPath = path.resolve(__dirname, '../../client/public/cpn_supplier_bill_template.jpg');
const customerImgPath = path.resolve(__dirname, '../../client/public/cpn_blank_bill_template.jpg');
const billPrintTemplatePath = path.resolve(__dirname, '../../client/src/components/BillPrintTemplate.jsx');
const printModalPath = path.resolve(__dirname, '../../client/src/components/PrintModal.jsx');
const indexCssPath = path.resolve(__dirname, '../../client/src/index.css');

const billPrintTemplateContent = fs.readFileSync(billPrintTemplatePath, 'utf8');
const printModalContent = fs.readFileSync(printModalPath, 'utf8');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

// --- SECTION 1: ASSET VERIFICATION ---
console.log('--- Section 1: Template Asset Verification ---');

runTest('1.1 cpn_supplier_bill_template.jpg exists in client/public/', () => {
  assert.ok(fs.existsSync(supplierImgPath), 'cpn_supplier_bill_template.jpg must exist in client/public/');
  const stats = fs.statSync(supplierImgPath);
  assert.ok(stats.size > 50000, `Image file size (${stats.size} bytes) must be substantial`);
});

runTest('1.2 Customer bill template cpn_blank_bill_template.jpg remains untouched and present', () => {
  assert.ok(fs.existsSync(customerImgPath), 'Customer blank bill template must remain intact');
});

// --- SECTION 2: BILL PRINT TEMPLATE OVERLAY & A6 DIMENSIONS ---
console.log('\n--- Section 2: BillPrintTemplate Dynamic Overlay & Dimensions ---');

runTest('2.1 BillPrintTemplate.jsx conditionally selects supplier image template for supplier bills', () => {
  assert.ok(
    billPrintTemplateContent.includes("isSupplierBill ? '/cpn_supplier_bill_template.jpg' : '/cpn_blank_bill_template.jpg'"),
    'Must switch to cpn_supplier_bill_template.jpg when isSupplierBill is true'
  );
});

runTest('2.2 BillPrintTemplate.jsx applies cpn-a6-bill class and 105mm × 148mm dimensions for supplier bills', () => {
  assert.ok(
    billPrintTemplateContent.includes("isSupplierBill ? 'cpn-a6-bill' : 'cpn-a5-bill'"),
    'Must use cpn-a6-bill class for supplier bills'
  );
  assert.ok(
    billPrintTemplateContent.includes("width: isSupplierBill ? '105mm' : '148mm'"),
    'Must enforce 105mm width for supplier bills'
  );
  assert.ok(
    billPrintTemplateContent.includes("height: isSupplierBill ? '148mm' : '210mm'"),
    'Must enforce 148mm height for supplier bills'
  );
});

runTest('2.3 Customer bills strictly preserve cpn-a5-bill class and 148mm × 210mm dimensions', () => {
  assert.ok(
    billPrintTemplateContent.includes("'cpn-a5-bill'") &&
    billPrintTemplateContent.includes("'148mm'") &&
    billPrintTemplateContent.includes("'210mm'"),
    'Customer bills must retain A5 portrait paper dimensions'
  );
});

runTest('2.4 BillPrintTemplate.jsx maps party name, date and all 5 table columns dynamically', () => {
  assert.ok(billPrintTemplateContent.includes('partyName'), 'Must compute partyName');
  assert.ok(billPrintTemplateContent.includes('billDateFormatted'), 'Must compute billDateFormatted');
  assert.ok(billPrintTemplateContent.includes('getVegetableDisplayName(item)'), 'Must resolve vegetable display name');
  assert.ok(billPrintTemplateContent.includes('formatNumber(item.rate)'), 'Must format vegetable rate');
  assert.ok(billPrintTemplateContent.includes('item.bag > 0 ? item.bag :'), 'Must format bag quantity');
  assert.ok(billPrintTemplateContent.includes('formatNumber(item.weight)'), 'Must format weight');
  assert.ok(billPrintTemplateContent.includes('formatCurrency(itemAmount)'), 'Must format amount');
});

runTest('2.5 Summary mapping: Row 4 label patch is suppressed for supplier bills (pre-printed natively)', () => {
  assert.ok(
    billPrintTemplateContent.includes('!isSupplierBill &&') &&
    billPrintTemplateContent.includes('செலுத்திய தொகை :'),
    'Row 4 white cover patch must only render for customer bills, never for supplier bills'
  );
});

runTest('2.6 Summary mapping: Row 2 date is placed cleanly inside date gap for supplier bills', () => {
  assert.ok(
    billPrintTemplateContent.includes('isSupplierBill ?') &&
    billPrintTemplateContent.includes('previousBalanceDateFormatted'),
    'Row 2 previous balance date must be positioned in the pre-printed date slot for supplier bills'
  );
});

runTest('2.7 Multi-page splitting: 10 items per page with continuation block and footer page indicators', () => {
  assert.ok(billPrintTemplateContent.includes('ITEMS_PER_PAGE = 10'), 'Must split at 10 items per page');
  assert.ok(
    billPrintTemplateContent.includes('தொடர்ச்சி அடுத்த பக்கம்') &&
    billPrintTemplateContent.includes('பக்கம் {page.pageNumber} / {page.totalPages}'),
    'Must display multi-page continuation block and page indicator'
  );
});

// --- SECTION 3: PRINT MODAL & IMAGE EXPORT DYNAMICS ---
console.log('\n--- Section 3: PrintModal Paper Sizing & Multi-format Export ---');

runTest('3.1 PrintModal.jsx detects isSupplierBill', () => {
  assert.ok(
    printModalContent.includes('const isSupplierBill = Boolean(') &&
    printModalContent.includes('bill?.isPurchase') &&
    printModalContent.includes('bill?.supplierName'),
    'PrintModal must detect supplier purchase bills'
  );
});

runTest('3.2 PrintModal.jsx injects dynamic @page rule with A6 (105mm 148mm) for supplier bills', () => {
  assert.ok(
    printModalContent.includes("isSupplierBill ? '105mm 148mm' : '148mm 210mm'"),
    'Must dynamically configure @page size to 105mm 148mm for supplier bills'
  );
});

runTest('3.3 PrintModal.jsx adds print-bill-supplier class to body when supplier bill is open', () => {
  assert.ok(
    printModalContent.includes("document.body.classList.add('print-bill-supplier')"),
    'Must add print-bill-supplier body class for supplier bills'
  );
  assert.ok(
    printModalContent.includes("document.body.classList.remove('print-bill-supplier')"),
    'Must cleanly remove print-bill-supplier on close'
  );
});

runTest('3.4 PrintModal.jsx updates header badge and target description to A6 for supplier bills', () => {
  assert.ok(
    printModalContent.includes("isSupplierBill ? 'A6' : 'A5'") &&
    printModalContent.includes("isSupplierBill ? '105 × 148 mm' : '148 × 210 mm'"),
    'Header badge and target text must reflect A6 portrait (105 × 148 mm) for supplier bills'
  );
});

runTest('3.5 renderAllBillPages uses exact A6 dimensions (396.85px × 559.37px) for supplier bill PNG exports', () => {
  assert.ok(
    printModalContent.includes('isSupplierBill ? 396.85 : 559.37') &&
    printModalContent.includes('isSupplierBill ? 559.37 : 793.70'),
    'Image export canvas must match A6 at 96 DPI for supplier bills'
  );
  assert.ok(
    printModalContent.includes("isSupplierBill ? '.cpn-a6-bill' : '.cpn-a5-bill'"),
    'Image export must query .cpn-a6-bill for supplier bills'
  );
});

// --- SECTION 4: CSS PRINT RULES & ZERO EXTRA BLANK PAGE INVARIANT ---
console.log('\n--- Section 4: CSS Print Rules & A6 Scoping ---');

runTest('4.1 index.css defines .cpn-a6-bill with exact A6 dimensions', () => {
  assert.ok(
    indexCssContent.includes('.cpn-a6-bill {') &&
    indexCssContent.includes('width: 105mm !important;') &&
    indexCssContent.includes('height: 147.5mm !important;'),
    '.cpn-a6-bill must enforce 105mm width and 147.5mm height in print CSS'
  );
});

runTest('4.2 index.css scopes supplier print container to 105mm', () => {
  assert.ok(
    indexCssContent.includes('body.print-bill-active.print-bill-supplier'),
    'Must define scoped styles for print-bill-supplier'
  );
});

runTest('4.3 index.css enforces page-break-after: avoid on :last-child to eliminate extra blank pages', () => {
  assert.ok(
    indexCssContent.includes('.cpn-a6-bill:last-child') &&
    indexCssContent.includes('break-after: avoid !important;'),
    'Must avoid page break after last sheet of bill'
  );
});

// --- SUMMARY ---
console.log('\n==================================================================');
console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log('==================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
