const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_PDF = path.resolve('test_bill_print.pdf');

// Create a standalone HTML test page that mimics exactly what client renders when PrintModal is open
const testHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>A5 Bill Print Test</title>
  <style>
    ${fs.readFileSync('client/dist/assets/index-C2a0OG38.css', 'utf8')}
  </style>
</head>
<body class="print-bill-active">
  <!-- This is the main application that should be COMPLETELY HIDDEN -->
  <div id="root">
    <div style="background: red; padding: 50px;">
      <h1>THIS IS THE WEB APPLICATION FORM / REPORT - IT MUST NEVER APPEAR IN PRINT!</h1>
      <p>Customer Name: Demo 01</p>
      <p>Rate: 35, Particulars: Ladies Finger</p>
    </div>
  </div>

  <!-- This is the print root portal that MUST BE THE ONLY THING THAT PRINTS -->
  <div id="print-root">
    <div class="print-modal-portal">
      <div class="print-modal-container">
        <!-- modal header chrome with .no-print -->
        <div class="no-print">
          <h2>Modal Header Controls - Must Not Print</h2>
        </div>
        <div class="print-modal-scroll-area">
          <div class="print-bill-scaler">
            <div id="printable-bill" class="cpn-a5-bill" style="width: 138mm; max-width: 138mm; box-sizing: border-box;">
              <!-- Header -->
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                <div style="width: 60px; height: 80px;">
                  <img src="client/public/cpn_logo.png" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                <div style="flex: 1; text-align: center;">
                  <div style="font-size: 11px; font-weight: bold; border-bottom: 1px solid #034D28; display: inline-block;">உ</div>
                  <div style="font-size: 11px; font-weight: bold; color: #034D28;">ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை</div>
                  <div style="border: 1.5px solid #034D28; border-radius: 8px; padding: 2px 12px; display: inline-block; margin: 2px 0;">
                    <h1 style="font-size: 18px; font-weight: 900; color: #034D28; margin: 0;">CPN VEGETABLES</h1>
                  </div>
                  <div style="font-size: 12px; font-weight: bold; color: #034D28;">இங்கிலீஷ் காய்கனி கமிஷன் மண்டி</div>
                  <div style="font-size: 10px; font-weight: 600; color: #034D28;">22-A, காந்தி மார்க்கெட், திண்டுக்கல்.</div>
                </div>
                <div style="text-align: right; font-size: 11px; font-weight: bold; color: #034D28;">
                  <div>97152 67025</div>
                  <div>97882 29090</div>
                  <div style="margin-top: 4px; font-size: 10px; background: #ecfdf5; border: 1px solid #034D28; padding: 2px 4px; border-radius: 4px;">எண்: CPN-0008</div>
                </div>
              </div>

              <!-- Customer Bar -->
              <div style="border-top: 1.5px solid #034D28; border-bottom: 1.5px solid #034D28; padding: 4px 8px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 4px 0;">
                <div>திரு: Demo 01 (932222052)</div>
                <div>தேதி: 10/11/2026</div>
              </div>

              <!-- 6-column Table -->
              <table class="print-table" style="width: 100%; border-collapse: collapse; border: 1.5px solid #034D28; font-size: 11px; margin: 4px 0;">
                <thead>
                  <tr style="background: #ecfdf5; color: #034D28; font-size: 10px; font-weight: 900;">
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 12%;">RATE</th>
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 40%; text-align: left;">PARTICULARS</th>
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 10%;">BAG</th>
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 12%; text-align: right;">WEIGHT</th>
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 13%; text-align: right;">DEBIT</th>
                    <th style="border: 1.5px solid #034D28; padding: 3px; width: 13%; text-align: right;">CREDIT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: center;">35</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: left;">Ladies Finger</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: center;">0</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right;">2</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right;">70.00</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right;">-</td>
                  </tr>
                  ${Array.from({ length: 7 }).map(() => `
                    <tr style="height: 22px;">
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                      <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                    </tr>
                  `).join('')}
                  <tr style="border-top: 1.5px solid #034D28; border-bottom: 1.5px solid #034D28; background: #ecfdf5; font-weight: 900; color: #034D28;">
                    <td style="border: 1.5px solid #034D28;">&nbsp;</td>
                    <td style="border: 1.5px solid #034D28; text-align: center;">TOTAL</td>
                    <td style="border: 1.5px solid #034D28; text-align: center;">0</td>
                    <td style="border: 1.5px solid #034D28; text-align: right;">2</td>
                    <td style="border: 1.5px solid #034D28; text-align: right;">70.00</td>
                    <td style="border: 1.5px solid #034D28; text-align: right;">-</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="border: 1.5px solid #034D28; padding: 3px; font-weight: bold; color: #034D28;">PREVIOUS BALANCE</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right; font-weight: bold;">8,000.00</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right;">-</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="border: 1.5px solid #034D28; padding: 3px; font-weight: bold; color: #034D28;">CASH RECEIVED</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right;">-</td>
                    <td style="border: 1.5px solid #034D28; padding: 3px; text-align: right; font-weight: bold;">2,000.00</td>
                  </tr>
                  <tr style="background: #ecfdf5; font-weight: 900; color: #034D28; font-size: 12px;">
                    <td colspan="4" style="border: 1.5px solid #034D28; padding: 4px; font-weight: 900;">CLOSING BALANCE</td>
                    <td style="border: 1.5px solid #034D28; padding: 4px; text-align: right; font-weight: 900; font-size: 13px;">6,070.00</td>
                    <td style="border: 1.5px solid #034D28; padding: 4px; text-align: right;">-</td>
                  </tr>
                </tbody>
              </table>

              <!-- Footer -->
              <div style="text-align: center; padding: 4px; font-size: 14px; font-weight: bold; color: #034D28;">
                வாழ்க வளமுடன்
              </div>
            </div>
          </div>
        </div>
        <div class="no-print">
          <p>Modal Footer Controls - Must Not Print</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

const TEST_HTML_PATH = path.resolve('test_bill_page.html');
fs.writeFileSync(TEST_HTML_PATH, testHtml);

console.log('Rendering A5 Bill to PDF via Chrome headless...');
try {
  const cmd = `"${CHROME_PATH}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${OUTPUT_PDF}" "file:///${TEST_HTML_PATH.replace(/\\/g, '/')}"`;
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(OUTPUT_PDF)) {
    const pdfBytes = fs.readFileSync(OUTPUT_PDF);
    const pdfText = pdfBytes.toString('latin1');
    const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 0;

    console.log(`\n========================================`);
    console.log(`PDF Generated Successfully: ${OUTPUT_PDF}`);
    console.log(`Total Pages in Output PDF: ${pageCount}`);
    console.log(`========================================\n`);

    if (pageCount === 1) {
      console.log('>>> TEST PASSED: Exactly 1 sheet of paper produced!');
    } else {
      console.error(`>>> TEST FAILED: Expected 1 sheet, got ${pageCount} sheets!`);
    }

    if (pdfText.includes('THIS IS THE WEB APPLICATION FORM') || pdfText.includes('Modal Header Controls')) {
      console.error('>>> TEST FAILED: Screen UI or Modal Chrome leaked into print output!');
    } else {
      console.log('>>> TEST PASSED: Screen UI and modal chrome completely suppressed!');
    }
  } else {
    console.error('PDF file was not created.');
  }
} catch (err) {
  console.error('Error executing Chrome headless:', err.message);
} finally {
  if (fs.existsSync(TEST_HTML_PATH)) fs.unlinkSync(TEST_HTML_PATH);
}
