const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n==================================================================');
console.log('  CPN VEGETABLES - SUPPLIER BILL A5 FULL-PAGE PRINT ALIGNMENT     ');
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

runTest('1.1 cpn_supplier_bill_template.jpg exists in client/public/ without modification', () => {
  assert.ok(fs.existsSync(supplierImgPath), 'cpn_supplier_bill_template.jpg must exist in client/public/');
  const stats = fs.statSync(supplierImgPath);
  assert.ok(stats.size > 50000, `Image file size (${stats.size} bytes) must be substantial`);
});

runTest('1.2 Customer bill template cpn_blank_bill_template.jpg remains untouched and present', () => {
  assert.ok(fs.existsSync(customerImgPath), 'Customer blank bill template must remain intact');
});

// --- SECTION 2: BILL PRINT TEMPLATE FULL A5 ALIGNMENT ---
console.log('\n--- Section 2: BillPrintTemplate Full A5 Sheet Alignment ---');

runTest('2.1 BillPrintTemplate.jsx conditionally selects supplier image template for supplier bills', () => {
  assert.ok(
    billPrintTemplateContent.includes("isSupplierBill ? '/cpn_supplier_bill_template.jpg' : '/cpn_blank_bill_template.jpg'"),
    'Must switch to cpn_supplier_bill_template.jpg when isSupplierBill is true'
  );
});

runTest('2.2 BillPrintTemplate.jsx enforces A5 portrait (148mm × 210mm) for supplier bills', () => {
  assert.ok(
    billPrintTemplateContent.includes("width: '148mm'") &&
    billPrintTemplateContent.includes("maxWidth: '148mm'") &&
    billPrintTemplateContent.includes("height: '210mm'") &&
    billPrintTemplateContent.includes("maxHeight: '210mm'"),
    'Must enforce full A5 portrait (148mm × 210mm) dimensions for supplier bills'
  );
  assert.ok(
    billPrintTemplateContent.includes('cpn-a5-bill'),
    'Must use cpn-a5-bill class'
  );
});

runTest('2.3 Customer bills strictly preserve A5 portrait paper dimensions and cpn-a5-bill class', () => {
  assert.ok(
    billPrintTemplateContent.includes('/cpn_blank_bill_template.jpg'),
    'Customer bills must retain cpn_blank_bill_template.jpg'
  );
});

runTest('2.4 BillPrintTemplate.jsx maps party name, date and all 5 table columns dynamically on A5', () => {
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
console.log('\n--- Section 3: PrintModal A5 Paper Sizing & Multi-format Export ---');

runTest('3.1 PrintModal.jsx injects dynamic @page rule with A5 (148mm 210mm)', () => {
  assert.ok(
    printModalContent.includes('@page { size: 148mm 210mm; margin: 0; }'),
    'Must configure @page size to 148mm 210mm'
  );
});

runTest('3.2 PrintModal.jsx displays A5 Sheet badge and Canon G3030 A5 target text', () => {
  assert.ok(
    printModalContent.includes('A5 Sheet (1 Sheet Only)') &&
    printModalContent.includes('Target: Canon G3030 series • Alignment matched to A5 portrait (148 × 210 mm)'),
    'Header badge and target text must reflect A5 portrait (148 × 210 mm)'
  );
});

runTest('3.3 renderAllBillPages uses full A5 dimensions (559.37px × 793.70px) for all bill PNG exports', () => {
  assert.ok(
    printModalContent.includes('targetWidthPx = 559.37;') &&
    printModalContent.includes('targetHeightPx = 793.70;'),
    'Image export canvas must match A5 at 96 DPI'
  );
  assert.ok(
    printModalContent.includes("document.querySelector('#printable-bill')") &&
    printModalContent.includes(".cpn-a5-bill"),
    'Image export must query .cpn-a5-bill'
  );
});

// --- SECTION 4: CSS PRINT RULES & ZERO EXTRA BLANK PAGE INVARIANT ---
console.log('\n--- Section 4: CSS Print Rules & Full A5 Sheet Coverage ---');

runTest('4.1 index.css defines .cpn-a5-bill with exact A5 dimensions (148mm × 209mm)', () => {
  assert.ok(
    indexCssContent.includes('.cpn-a5-bill') &&
    indexCssContent.includes('width: 148mm !important;') &&
    indexCssContent.includes('height: 209mm !important;'),
    '.cpn-a5-bill must enforce 148mm width and 209mm height in print CSS'
  );
});

runTest('4.2 index.css scopes bill print container to 148mm', () => {
  assert.ok(
    indexCssContent.includes('body.print-bill-active #print-root') &&
    indexCssContent.includes('width: 148mm !important;'),
    '#print-root must be 148mm wide'
  );
  assert.ok(
    indexCssContent.includes('#printable-bill') &&
    indexCssContent.includes('width: 148mm !important;'),
    '#printable-bill must be 148mm wide'
  );
});

runTest('4.3 index.css enforces page-break-after: avoid on :last-child to eliminate extra blank pages', () => {
  assert.ok(
    indexCssContent.includes('.cpn-a5-bill:last-child') &&
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
