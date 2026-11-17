const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================');
console.log('  CPN VEGETABLES - BILL IMAGE DOWNLOAD & PRINT MENU   ');
console.log('======================================================\n');

const printModalPath = path.resolve(__dirname, '../../client/src/components/PrintModal.jsx');
const printModalContent = fs.readFileSync(printModalPath, 'utf8');

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

// 1. Windows Print Dialog Removal
runTest('1. Windows Print Dialog is completely removed from PrintModal', () => {
  assert.strictEqual(
    printModalContent.includes('Windows Print Dialog'),
    false,
    'Windows Print Dialog text should not appear anywhere in PrintModal'
  );
  assert.strictEqual(
    printModalContent.includes('openDialog ?'),
    false,
    'openDialog references should not be present'
  );
  assert.strictEqual(
    printModalContent.includes('Select tray or custom paper'),
    false,
    'Windows Print Dialog subtitle should not be present'
  );
});

// 2. Removal of Browser Print Preview and Download PDF options
runTest('2. Browser Print Preview and Download PDF options are completely removed', () => {
  assert.strictEqual(
    printModalContent.includes('Browser Print Preview'),
    false,
    'Browser Print Preview must be completely removed from PrintModal'
  );
  assert.strictEqual(
    printModalContent.includes('Download PDF'),
    false,
    'Download PDF must be completely removed from PrintModal'
  );
});

// 3. Dropdown Menu Structure & Order (Direct to Canon G3030 + Download Bill Image only)
runTest('3. Dropdown menu contains ONLY Direct to Canon G3030 and Download Bill Image', () => {
  const dropdownStart = printModalContent.indexOf('{/* Options Dropdown Menu */}');
  assert.ok(dropdownStart !== -1, 'Options Dropdown Menu section should exist');
  const dropdownSection = printModalContent.slice(dropdownStart);

  const canonIdx = dropdownSection.indexOf('Direct to Canon G3030');
  const imageIdx = dropdownSection.indexOf('Download Bill Image');

  assert.ok(canonIdx !== -1, 'Direct to Canon G3030 must be present in dropdown');
  assert.ok(imageIdx !== -1, 'Download Bill Image must be present in dropdown');
  assert.ok(canonIdx < imageIdx, 'Direct to Canon G3030 must precede Download Bill Image');

  // Verify other options are absent from the dropdown
  assert.strictEqual(dropdownSection.includes('Browser Print Preview'), false);
  assert.strictEqual(dropdownSection.includes('Download PDF'), false);
});

// 4. Download Bill Image Option & Icon
runTest('4. "Download Bill Image" option is present in PrintModal dropdown with ImageDown icon', () => {
  assert.ok(
    printModalContent.includes('Download Bill Image'),
    '"Download Bill Image" text must be present in the dropdown menu'
  );
  assert.ok(
    printModalContent.includes('ImageDown'),
    'ImageDown icon from lucide-react must be used for Download Bill Image'
  );
  assert.ok(
    printModalContent.includes('handleDownloadImage'),
    'handleDownloadImage click handler must be wired to the button'
  );
});

// 5. One-Click Image Export Engine (html-to-image, 3x pixel ratio, unscaled container)
runTest('5. One-click image download logic captures isolated unscaled bill and uses 3x pixel ratio', () => {
  assert.ok(
    printModalContent.includes('pixelRatio: 3'),
    'Image export must use at least 3x pixel ratio for ultra-crisp resolution'
  );
  assert.ok(
    printModalContent.includes('toBlob'),
    'html-to-image toBlob should be imported and used'
  );
  assert.ok(
    printModalContent.includes('document.fonts.ready'),
    'Must wait for Tamil fonts to be loaded before capture'
  );
  assert.ok(
    printModalContent.includes('exportContainer'),
    'Must use dedicated unscaled export container to prevent mobile viewport scale interference'
  );
});

// 6. CPN A5 (148mm x 210mm) Physical Paper Dimensions & Math
runTest('6. A5 (148x210mm) portrait dimensions strictly defined and calculated at 96 DPI', () => {
  assert.ok(printModalContent.includes('559.37'), 'A5 148mm width (559.37px) defined');
  assert.ok(printModalContent.includes('793.70'), 'A5 210mm height (793.70px) defined');

  const a5_3xW = Math.round(559.37 * 3);
  const a5_3xH = Math.round(793.70 * 3);
  assert.strictEqual(a5_3xW, 1678, 'A5 width at 3x is 1678px');
  assert.strictEqual(a5_3xH, 2381, 'A5 height at 3x is 2381px');

  const targetRatio = 148 / 210;
  const actualRatio = a5_3xW / a5_3xH;
  assert.ok(Math.abs(actualRatio - targetRatio) < 0.001, 'A5 aspect ratio matches ISO A5 standard');
});

// 7. Meaningful Filename Format
runTest('7. Meaningful filename format matches specification (e.g. Bill_CPN-0005_Customer_2026-11-17.png)', () => {
  assert.ok(
    printModalContent.includes('Bill_${billNum}_'),
    'Filename prefix Bill_${billNum}_ should be used'
  );
  assert.ok(
    printModalContent.includes('.png'),
    'Exported image filename extension must be .png'
  );
  assert.ok(
    printModalContent.includes('pageSuffix'),
    'Multi-sheet bills must include page suffix (e.g. _Page1, _Page2)'
  );
});

// 8. Device Support: Mobile Share (Android/iOS) + Desktop Download Fallback
runTest('8. Device-specific behaviour: Web Share API for mobile + browser download fallback', () => {
  assert.ok(
    printModalContent.includes('navigator.canShare'),
    'Must check navigator.canShare for file sharing support'
  );
  assert.ok(
    printModalContent.includes('navigator.share'),
    'Must support navigator.share for mobile sheet (Save to Photos / WhatsApp)'
  );
  assert.ok(
    printModalContent.includes('a.download = filename'),
    'Must support standard browser download trigger for desktop and mobile fallback'
  );
});

// 9. Existing Direct Print to Canon G3030 Preserved
runTest('9. Direct print to Canon G3030 preserved', () => {
  assert.ok(printModalContent.includes('handleDirectPrint'), 'Direct print to Canon G3030 preserved');
});

console.log('------------------------------------------------------');
console.log(`  RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('------------------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
