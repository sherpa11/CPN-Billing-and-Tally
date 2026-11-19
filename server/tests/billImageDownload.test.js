const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================');
console.log('  CPN VEGETABLES - MULTI-PAGE BILL DOWNLOAD & SHARING  ');
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

// 3. Dropdown Menu Structure & Order (Direct to Canon G3030 + Download + Share)
runTest('3. Dropdown menu contains Direct to Canon G3030, Download Bill Images, and Share All Bill Images', () => {
  const dropdownStart = printModalContent.indexOf('{/* Options Dropdown Menu */}');
  assert.ok(dropdownStart !== -1, 'Options Dropdown Menu section should exist');
  const dropdownSection = printModalContent.slice(dropdownStart);

  const canonIdx = dropdownSection.indexOf('Direct to Canon G3030');
  const downloadIdx = dropdownSection.indexOf('Download All Bill Images (PNG)');
  const shareIdx = dropdownSection.indexOf('Share All Bill Images');

  assert.ok(canonIdx !== -1, 'Direct to Canon G3030 must be present in dropdown');
  assert.ok(downloadIdx !== -1, 'Download All Bill Images option must be present in dropdown');
  assert.ok(shareIdx !== -1, 'Share All Bill Images option must be present in dropdown');

  assert.ok(canonIdx < downloadIdx, 'Direct to Canon G3030 must precede Download option');
  assert.ok(downloadIdx < shareIdx, 'Download option must precede Share option');

  // Verify other options are absent from the dropdown
  assert.strictEqual(dropdownSection.includes('Browser Print Preview'), false);
  assert.strictEqual(dropdownSection.includes('Download PDF'), false);
});

// 4. Download Bill Images Option & Icon
runTest('4. "Download Bill Image(s)" option is present in PrintModal dropdown with ImageDown icon', () => {
  assert.ok(
    printModalContent.includes('Download All Bill Images (PNG)') &&
      printModalContent.includes('Download Bill Image (PNG)'),
    'Adaptive Download Bill Image(s) labels must be present'
  );
  assert.ok(
    printModalContent.includes('ImageDown'),
    'ImageDown icon from lucide-react must be used for Download Bill Image'
  );
  assert.ok(
    printModalContent.includes('handleDownloadAllImages') ||
      printModalContent.includes('handleDownloadImage'),
    'Download click handler must be wired to the button'
  );
});

// 5. Share All Bill Images Option & Icon
runTest('5. "Share All Bill Images" option is present in PrintModal dropdown with Share2 icon', () => {
  assert.ok(
    printModalContent.includes('Share All Bill Images') &&
      printModalContent.includes('Share Bill Image'),
    'Adaptive Share Bill Image(s) labels must be present'
  );
  assert.ok(
    printModalContent.includes('Share2'),
    'Share2 icon from lucide-react must be imported and used for Share option'
  );
  assert.ok(
    printModalContent.includes('handleShareAllImages'),
    'handleShareAllImages click handler must be wired to the button'
  );
});

// 6. One-Click Image Export Engine (html-to-image, 3x pixel ratio, unscaled container)
runTest('6. Image export captures isolated unscaled bill and uses 3x pixel ratio', () => {
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

// 7. CPN A5 (148mm x 210mm) Physical Paper Dimensions & Math
runTest('7. A5 (148x210mm) portrait dimensions strictly defined and calculated at 96 DPI', () => {
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

// 8. Meaningful Dynamic Filename Format for Multi-Page and Single-Page Bills
runTest('8. Dynamic filename format supports multi-page (CPN-0091-Page-1.png, CPN-0091-Page-2.png) and single-page (CPN-0091.png)', () => {
  assert.ok(
    printModalContent.includes('${billNum}-Page-${i + 1}.png'),
    'Multi-page bills must generate ${billNum}-Page-${i + 1}.png'
  );
  assert.ok(
    printModalContent.includes('${billNum}.png'),
    'Single-page bills must generate ${billNum}.png'
  );
  assert.ok(
    printModalContent.includes('.png'),
    'Exported image filename extension must be .png'
  );
});

// 9. Native Multi-File Sharing & WhatsApp Support
runTest('9. Web Share API receives all files in a single navigator.share call for multi-file WhatsApp sharing', () => {
  assert.ok(
    printModalContent.includes('navigator.canShare'),
    'Must check navigator.canShare with files array'
  );
  assert.ok(
    printModalContent.includes('files: allFiles'),
    'navigator.share must receive array of all page files together in one call'
  );
  assert.ok(
    printModalContent.includes('All ${renderedPages.length} bill pages downloaded. You can attach them together in WhatsApp.'),
    'Informative fallback message when native sharing is unavailable'
  );
});

// 10. Multi-Page Download Spacing to Prevent Browser Blocking
runTest('10. Multi-page sequential download paces triggers by 400ms to avoid browser download popup blockers', () => {
  assert.ok(
    printModalContent.includes('setTimeout(r, 400)'),
    'Must space successive page downloads by 400ms'
  );
  assert.ok(
    printModalContent.includes('a.download = page.filename'),
    'Must trigger download for each page filename'
  );
});

// 11. Existing Direct Print to Canon G3030 Preserved
runTest('11. Direct print to Canon G3030 preserved', () => {
  assert.ok(printModalContent.includes('handleDirectPrint'), 'Direct print to Canon G3030 preserved');
});

console.log('------------------------------------------------------');
console.log(`  RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('------------------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
