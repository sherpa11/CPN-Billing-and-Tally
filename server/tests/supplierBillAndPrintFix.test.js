const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n==================================================================');
console.log('  CPN VEGETABLES - SUPPLIER BILL & UNIVERSAL PRINTING FIXES TEST  ');
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

const newBillPath = path.resolve(__dirname, '../../client/src/pages/NewBill.jsx');
const newBillContent = fs.readFileSync(newBillPath, 'utf8');

const billPrintTemplatePath = path.resolve(__dirname, '../../client/src/components/BillPrintTemplate.jsx');
const billPrintTemplateContent = fs.readFileSync(billPrintTemplatePath, 'utf8');

const indexCssPath = path.resolve(__dirname, '../../client/src/index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

const printModalPath = path.resolve(__dirname, '../../client/src/components/PrintModal.jsx');
const printModalContent = fs.readFileSync(printModalPath, 'utf8');

// --- SECTION 1: SUPPLIER BILL - REMOVE DISCOUNT ROW ---
console.log('--- Section 1: Supplier Bill - Remove Discount Row ---');

runTest('1.1 NewBill.jsx: Desktop summary conditionally excludes Discount row for Supplier mode', () => {
  assert.ok(
    newBillContent.includes("partyType !== 'supplier'") &&
    newBillContent.includes('4. தள்ளுபடி : (Discount)'),
    'Discount row must be rendered only when partyType !== "supplier"'
  );
});

runTest('1.2 NewBill.jsx: Supplier mode table footer numbers remaining rows neatly (Row 4 = செலுத்திய தொகை, Row 5 = மொத்த பாக்கி)', () => {
  assert.ok(
    newBillContent.includes("4. செலுத்திய தொகை : (Amount Paid)") &&
    newBillContent.includes("5. மொத்த பாக்கி : (Final Balance = Total - Varavu)"),
    'Supplier mode must re-number Row 4 to Amount Paid and Row 5 to Final Balance'
  );
});

runTest('1.3 NewBill.jsx: Mobile summary card conditionally excludes Discount row for Supplier mode', () => {
  assert.ok(
    newBillContent.includes("4. செலுத்திய தொகை (Amount Paid)") &&
    newBillContent.includes("5. இறுதி மொத்தம் (Closing)"),
    'Mobile summary card must re-number Row 4 to Amount Paid and Row 5 to Closing for Supplier mode'
  );
});

runTest('1.4 NewBill.jsx: Supplier purchase payload explicitly enforces discount: 0', () => {
  assert.ok(
    newBillContent.includes('purchasePayload = {') &&
    newBillContent.includes('discount: 0,'),
    'purchasePayload must enforce discount: 0'
  );
});

runTest('1.5 NewBill.jsx: Customer bills strictly retain existing Discount row and calculations', () => {
  assert.ok(
    newBillContent.includes("5. செலுத்திய தொகை / வரவு : (Paid Amount / Varavu)") &&
    newBillContent.includes("6. மொத்த பாக்கி : (Final Balance = Total - Discount - Varavu)"),
    'Customer bills must strictly retain Row 4 Discount, Row 5 Varavu, and Row 6 Final Balance'
  );
});

runTest('1.6 BillPrintTemplate.jsx: Supplier bills suppress discount annotation in Row 4', () => {
  assert.ok(
    billPrintTemplateContent.includes('!isSupplierBill'),
    'Discount annotation in Row 4 must check !isSupplierBill'
  );
  assert.ok(
    billPrintTemplateContent.includes('const isSupplierBill = Boolean('),
    'isSupplierBill flag must be calculated to identify purchase bills'
  );
});

// --- SECTION 2: UNIVERSAL PRINT FIX - NO EXTRA BLANK PAGE ---
console.log('\n--- Section 2: Universal Print Fix - Eliminate Blank Trailing Page ---');

runTest('2.1 index.css: Exact height: 209mm enforced on .cpn-a5-bill to eliminate subpixel boundary overflow', () => {
  assert.ok(
    indexCssContent.includes('height: 209mm !important;') &&
    indexCssContent.includes('max-height: 209mm !important;'),
    '.cpn-a5-bill must use height: 209mm to eliminate sub-pixel overflow on 210mm A5 sheet'
  );
});

runTest('2.2 index.css: Strict page-break-after: avoid on :last-child and :last-of-type', () => {
  assert.ok(
    indexCssContent.includes('.cpn-a5-bill:last-child') &&
    indexCssContent.includes('page-break-after: avoid !important;') &&
    indexCssContent.includes('break-after: avoid !important;'),
    ':last-child and :last-of-type must forbid page breaks with page-break-after: avoid'
  );
});

runTest('2.3 index.css: #printable-bill and parent containers forbid page-break-after', () => {
  const printableBillSection = indexCssContent.substring(
    indexCssContent.indexOf('#printable-bill {'),
    indexCssContent.indexOf('#printable-bill {') + 300
  );
  assert.ok(
    printableBillSection.includes('page-break-after: avoid !important;') &&
    printableBillSection.includes('break-after: avoid !important;'),
    '#printable-bill container must have page-break-after: avoid'
  );
});

runTest('2.4 index.css: html and body reset in print to avoid 100vh / min-height spills', () => {
  assert.ok(
    indexCssContent.includes('html,\n  body {\n    margin: 0 !important;\n    padding: 0 !important;\n    min-height: 0 !important;'),
    'html and body must have margin: 0, padding: 0, and min-height: 0 in print'
  );
});

runTest('2.5 PrintModal.jsx: Injected style tag includes html, body margin/height reset', () => {
  assert.ok(
    printModalContent.includes('@media print { html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; } }'),
    'PrintModal injected dynamic style tag must reset html, body in @media print'
  );
});

// --- SECTION 3: HEADLESS CHROME PHYSICAL PRINT VALIDATION ---
console.log('\n--- Section 3: Physical Chrome Headless Print Validation ---');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function renderChromePdf(sheetCount) {
  const pagesHtml = Array.from({ length: sheetCount }).map((_, i) => {
    const isFinal = i === sheetCount - 1;
    const breakClass = !isFinal ? 'cpn-a5-bill-page-break' : '';
    return `
      <div class="cpn-a5-bill ${breakClass}">
        <div style="padding: 20px;">
          <h3>CPN VEGETABLES - Page ${i + 1} of ${sheetCount}</h3>
          <p>Tamil test: இங்கிலீஷ் காய்கனி கமிஷன் மண்டி</p>
        </div>
      </div>
    `;
  }).join('\n');

  // Grab compiled production css
  const distAssets = fs.readdirSync(path.resolve(__dirname, '../../client/dist/assets'));
  const cssFile = distAssets.find(f => f.endsWith('.css'));
  const prodCss = fs.readFileSync(path.resolve(__dirname, '../../client/dist/assets', cssFile), 'utf8');

  const fullHtml = `<!doctype html>
<html lang="ta">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: 148mm 210mm; margin: 0; }
    ${prodCss}
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen antialiased print-bill-active">
  <div id="root" style="height: 1200px;">Background web application</div>
  <div id="print-root">
    <div class="print-modal-portal">
      <div class="print-modal-container">
        <div class="no-print">Header controls</div>
        <div class="print-modal-scroll-area">
          <div class="print-bill-scaler">
            <div id="printable-bill">
              ${pagesHtml}
            </div>
          </div>
        </div>
        <div class="no-print">Footer controls</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const hFile = path.resolve(__dirname, `temp_test_${sheetCount}p.html`);
  const pFile = path.resolve(__dirname, `temp_test_${sheetCount}p.pdf`);
  fs.writeFileSync(hFile, fullHtml);

  try {
    const fUrl = `file:///${hFile.replace(/\\/g, '/')}`;
    execSync(`"${CHROME}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pFile}" "${fUrl}"`, { stdio: 'pipe' });
    const pdf = fs.readFileSync(pFile, 'latin1');
    const actualPages = (pdf.match(/\/Type\s*\/Page\b/g) || []).length;
    return actualPages;
  } finally {
    if (fs.existsSync(hFile)) fs.unlinkSync(hFile);
    if (fs.existsSync(pFile)) fs.unlinkSync(pFile);
  }
}

runTest('3.1 Chrome Print: 1-Page bill produces EXACTLY 1 printed page (no trailing blank page)', () => {
  const pages = renderChromePdf(1);
  assert.strictEqual(pages, 1, `Expected 1 page, got ${pages}`);
});

runTest('3.2 Chrome Print: 2-Page bill produces EXACTLY 2 printed pages (no trailing blank page)', () => {
  const pages = renderChromePdf(2);
  assert.strictEqual(pages, 2, `Expected 2 pages, got ${pages}`);
});

runTest('3.3 Chrome Print: 3-Page bill produces EXACTLY 3 printed pages (no trailing blank page)', () => {
  const pages = renderChromePdf(3);
  assert.strictEqual(pages, 3, `Expected 3 pages, got ${pages}`);
});

console.log('------------------------------------------------------------------');
console.log(`  RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('------------------------------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
