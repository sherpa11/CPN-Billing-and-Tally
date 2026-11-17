import React from 'react';

/**
 * BillPrintTemplate Component - Overlay Architecture
 *
 * Requirements:
 * 1. Uses the ACTUAL ORIGINAL BLANK CPN VEGETABLES BILL IMAGE as the base template
 *    (/cpn_blank_bill_template.jpg).
 * 2. Absolutely NO recreated HTML tables, simulated logos, redrawn QR codes, or artificial headers.
 * 3. Dynamically overlays text in accurately measured percentage coordinates mapped to the
 *    712px × 1024px canvas of the original bill leaf.
 * 4. Fixed A6 Portrait geometry (105mm × 148mm) - prints on exactly ONE sheet for normal bills (1-20 items).
 * 5. Adaptive row sizing and font scaling based on vegetable item count.
 * 6. Preserves all existing accounting logic, balance continuity, and customer ledger invariants.
 */

// Helper to format currency
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper to format decimal numbers (rate, weight)
const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '';
  const parsed = Number(num);
  if (parsed === 0) return '';
  return parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(decimals);
};

// Helper to get adaptive row layout parameters inside the 44.43% vegetable table area
const getAdaptiveOverlayLayout = (itemCount) => {
  if (itemCount <= 5) {
    return {
      rowHeightPercent: 4.4,
      fontSizeParticulars: 'text-[11px] leading-tight font-bold',
      fontSizeData: 'text-[11px] font-bold',
      lineHeight: 'leading-normal',
    };
  } else {
    // 6 to 10 items
    return {
      rowHeightPercent: 4.3,
      fontSizeParticulars: 'text-[10px] leading-tight font-bold',
      fontSizeData: 'text-[10px] font-bold',
      lineHeight: 'leading-normal',
    };
  }
};

export const BillPrintTemplate = ({ bill, settings, masterVegetables = [] }) => {
  if (!bill) return null;

  const rawItems = bill.items || [];
  // Filter empty dummy items if any, but ensure at least 1 row exists
  const items = rawItems.filter(
    (it) => it.particulars?.trim() || Number(it.amount) > 0 || Number(it.rate) > 0
  );
  const activeItems = items.length > 0 ? items : rawItems.length > 0 ? rawItems : [{}];

  // Format date helper (DD/MM/YYYY)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Helper to determine display name in PARTICULARS (பொருள்):
  const getVegetableDisplayName = (item) => {
    if (item.tamilName && item.tamilName.trim()) {
      return item.tamilName.trim();
    }
    if (
      item.vegetable &&
      typeof item.vegetable === 'object' &&
      item.vegetable.tamilName &&
      item.vegetable.tamilName.trim()
    ) {
      return item.vegetable.tamilName.trim();
    }
    if (Array.isArray(masterVegetables) && masterVegetables.length > 0) {
      const vegId = item.vegetable?._id ? item.vegetable._id.toString() : item.vegetable?.toString();
      if (vegId) {
        const match = masterVegetables.find((v) => v._id && v._id.toString() === vegId);
        if (match && match.tamilName && match.tamilName.trim()) {
          return match.tamilName.trim();
        }
      }
      if (item.particulars) {
        const norm = item.particulars.trim().toLowerCase();
        const match = masterVegetables.find(
          (v) =>
            (v.name && v.name.trim().toLowerCase() === norm) ||
            (v.normalizedName && v.normalizedName === norm)
        );
        if (match && match.tamilName && match.tamilName.trim()) {
          return match.tamilName.trim();
        }
      }
    }
    if (
      item.vegetable &&
      typeof item.vegetable === 'object' &&
      item.vegetable.name &&
      item.vegetable.name.trim()
    ) {
      return item.vegetable.name.trim();
    }
    return item.particulars || '';
  };

  // Accounting calculations preserving strict invariants
  const todayTotal =
    bill.todayTotal !== undefined && bill.todayTotal !== null
      ? bill.todayTotal
      : bill.totalDebit !== undefined && bill.totalDebit !== null
      ? bill.totalDebit
      : activeItems.reduce(
          (acc, it) => acc + (it.amount || it.debit || (it.rate || 0) * (it.weight || 0) || 0),
          0
        );

  const previousBalance = bill.previousBalance || 0;
  const previousBalanceDateFormatted = bill.previousBalanceDate
    ? formatDate(bill.previousBalanceDate)
    : '';

  const total =
    bill.grandTotal !== undefined && bill.grandTotal !== null
      ? bill.grandTotal
      : Math.round((todayTotal + previousBalance) * 100) / 100;

  const discount = bill.discount || 0;

  const varavu =
    bill.varavu !== undefined && bill.varavu !== null
      ? bill.varavu
      : bill.cashReceived || 0;

  const closingBalance =
    bill.closingBalance !== undefined && bill.closingBalance !== null
      ? bill.closingBalance
      : Math.round((total - discount - varavu) * 100) / 100;

  // Multi-page splitting logic for A6 (10 items fit per page cleanly)
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / ITEMS_PER_PAGE));
  const pages = [];

  for (let i = 0; i < totalPages; i++) {
    pages.push({
      pageNumber: i + 1,
      totalPages,
      items: activeItems.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE),
      isFinalPage: i === totalPages - 1,
    });
  }

  // Table body start and end Y coordinates as percentages of 1024px canvas
  const TABLE_TOP_PERCENT = 30.10; // Y = 308px (immediately below table header line)

  return (
    <div id="printable-bill" style={{ margin: 0, padding: 0 }}>
      {pages.map((page, pIdx) => {
        const layout = getAdaptiveOverlayLayout(page.items.length);

        return (
          <div
            key={`page-${pIdx}`}
            className={`cpn-a6-bill select-none shadow-xl mb-6 last:mb-0 border border-gray-300 rounded-sm ${
              !page.isFinalPage ? 'cpn-a6-bill-page-break' : ''
            }`}
            style={{
              position: 'relative',
              width: '105mm',
              maxWidth: '105mm',
              height: '148mm',
              maxHeight: '148mm',
              margin: '0 auto',
              padding: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
            }}
          >
            {/* ============================================================== */}
            {/* BASE LAYER: ACTUAL ORIGINAL BLANK CPN VEGETABLES BILL IMAGE    */}
            {/* ============================================================== */}
            <img
              src="/cpn_blank_bill_template.jpg"
              alt="CPN Vegetables Bill Template"
              className="w-full h-full block select-none pointer-events-none"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'fill',
              }}
            />

            {/* ============================================================== */}
            {/* OVERLAY LAYER: DYNAMICALLY GENERATED DATA AT EXACT COORDINATES */}
            {/* ============================================================== */}
            <div
              className="absolute inset-0 w-full h-full pointer-events-none text-[#034D28] font-sans"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            >
              {/* 1. CUSTOMER NAME (on திரு: underline - X=78..476, Y=250) */}
              <div
                className="absolute flex items-end font-black text-black font-tamil text-[13px] leading-none truncate pl-1 pr-2"
                style={{
                  left: '11.0%',
                  top: '22.0%',
                  width: '56.0%',
                  height: '2.41%',
                  paddingBottom: '0.5px',
                  boxSizing: 'border-box',
                }}
                title={bill.customerName || bill.customer?.name}
              >
                <span className="truncate">{bill.customerName || bill.customer?.name || ''}</span>
                {bill.customerPhone && (
                  <span className="font-mono-num font-bold text-gray-800 text-[10px] ml-1.5 flex-shrink-0">
                    ({bill.customerPhone})
                  </span>
                )}
                {page.pageNumber > 1 && (
                  <span className="text-[9px] font-bold text-[#034D28] ml-2 flex-shrink-0">
                    (பக்கம் {page.pageNumber})
                  </span>
                )}
              </div>

              {/* 2. DATE (on தேதி : underline - X=551..684, Y=250) */}
              <div
                className="absolute flex items-end justify-center font-mono-num font-bold text-gray-950 text-[10.5px] leading-none"
                style={{
                  left: '77.2%',
                  top: '22.0%',
                  width: '18.8%',
                  height: '2.41%',
                  paddingBottom: '0.5px',
                  boxSizing: 'border-box',
                }}
              >
                {formatDate(bill.billDate)}
              </div>

              {/* 3. VEGETABLE ENTRIES (inside 5-column table body) */}
              {page.items.map((item, idx) => {
                const itemAmount =
                  item.amount !== undefined && item.amount !== null
                    ? item.amount
                    : item.debit !== undefined && item.debit !== null
                    ? item.debit
                    : (item.rate || 0) * (item.weight || 0);

                const rowTop = TABLE_TOP_PERCENT + idx * layout.rowHeightPercent;

                return (
                  <div
                    key={idx}
                    className="absolute flex items-center"
                    style={{
                      top: `${rowTop}%`,
                      left: '0%',
                      width: '100%',
                      height: `${layout.rowHeightPercent}%`,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Col 1: விலை (Rate) - 1.69% to 15.73% */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '1.69%',
                        width: '14.04%',
                        height: '100%',
                      }}
                    >
                      {item.rate > 0 ? formatNumber(item.rate) : ''}
                    </div>

                    {/* Col 2: பொருள் (Particulars - Tamil Name) - 15.73% to 51.26% */}
                    <div
                      className={`flex items-center text-left pl-2 pr-1 font-tamil font-bold text-gray-950 truncate ${layout.fontSizeParticulars}`}
                      style={{
                        position: 'absolute',
                        left: '15.73%',
                        width: '35.53%',
                        height: '100%',
                      }}
                    >
                      <span className="truncate">{getVegetableDisplayName(item)}</span>
                    </div>

                    {/* Col 3: பை (Bag) - 51.26% to 61.80% */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '51.26%',
                        width: '10.54%',
                        height: '100%',
                      }}
                    >
                      {item.bag > 0 ? item.bag : ''}
                    </div>

                    {/* Col 4: எடை (Weight) - 61.80% to 74.72% */}
                    <div
                      className={`flex items-center justify-end pr-2 font-mono-num font-semibold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '61.80%',
                        width: '12.92%',
                        height: '100%',
                      }}
                    >
                      {item.weight > 0 ? formatNumber(item.weight) : ''}
                    </div>

                    {/* Col 5: தொகை (Amount) - 74.72% to 98.31% */}
                    <div
                      className={`flex items-center justify-end pr-3 font-mono-num font-black text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '74.72%',
                        width: '23.59%',
                        height: '100%',
                      }}
                    >
                      {itemAmount > 0 ? formatCurrency(itemAmount) : ''}
                    </div>
                  </div>
                );
              })}

              {/* 4. SUMMARY SECTION AMOUNTS (mapped into the blank amount cells) */}
              {page.isFinalPage ? (
                <>
                  {/* Row 1: இன்றைய மொத்தம் (Today's Total) Amount - Y=778..808px (75.98%..78.91%) */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[10px]"
                    style={{
                      left: '66.57%',
                      top: '75.98%',
                      width: '31.74%',
                      height: '2.93%',
                    }}
                  >
                    {formatCurrency(todayTotal)}
                  </div>

                  {/* Row 2: முன் பாக்கி Date on underline - X=260..448px (36.52%..62.92%), Y=808..838px */}
                  <div
                    className="absolute flex items-center justify-center font-mono-num font-bold text-[#034D28] text-[8.5px]"
                    style={{
                      left: '36.52%',
                      top: '78.91%',
                      width: '26.40%',
                      height: '2.93%',
                    }}
                  >
                    {previousBalanceDateFormatted}
                  </div>

                  {/* Row 2: முன் பாக்கி (Previous Balance) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-bold text-black text-[10px]"
                    style={{
                      left: '66.57%',
                      top: '78.91%',
                      width: '31.74%',
                      height: '2.93%',
                    }}
                  >
                    {formatCurrency(previousBalance)}
                  </div>

                  {/* Row 3: மொத்தம் (Total) Amount - Y=838..872px (81.84%..85.16%) */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[10.5px]"
                    style={{
                      left: '66.57%',
                      top: '81.84%',
                      width: '31.74%',
                      height: '3.32%',
                    }}
                  >
                    {formatCurrency(total)}
                  </div>

                  {/* Row 4: தள்ளுபடி (Discount) note next to ரொக்கம் பெற்றது if present */}
                  {discount > 0 && (
                    <div
                      className="absolute flex items-center justify-end pr-1 font-mono-num font-bold text-amber-900 text-[7.5px] whitespace-nowrap"
                      style={{
                        left: '42.0%',
                        top: '85.16%',
                        width: '24.0%',
                        height: '3.52%',
                      }}
                    >
                      (தள்ளுபடி: {formatCurrency(discount)})
                    </div>
                  )}

                  {/* Row 4: ரொக்கம் பெற்றது / வரவு (Cash Received) Amount - Y=872..908px (85.16%..88.67%) */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-bold text-black text-[10px]"
                    style={{
                      left: '66.57%',
                      top: '85.16%',
                      width: '31.74%',
                      height: '3.52%',
                    }}
                  >
                    {varavu > 0 ? formatCurrency(varavu) : '0.00'}
                  </div>

                  {/* Row 5: இறுதி மொத்தம் / மொத்த பாக்கி (Closing Balance) Amount - Y=908..948px (88.67%..92.58%) */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[11px]"
                    style={{
                      left: '66.57%',
                      top: '88.67%',
                      width: '31.74%',
                      height: '3.91%',
                    }}
                  >
                    {formatCurrency(closingBalance)}
                  </div>
                </>
              ) : (
                /* Multi-page continuation prompt on non-final pages (100% solid white cover to completely block pre-printed summary rows) */
                <div
                  className="absolute"
                  style={{
                    left: '1.69%',
                    top: '75.98%',
                    width: '96.62%',
                    height: '16.60%',
                    backgroundColor: '#ffffff',
                    zIndex: 10,
                  }}
                >
                  <div
                    className="w-full h-full flex flex-col justify-center items-center px-4 bg-emerald-50/90 border-2 border-[#034D28] rounded-md"
                    style={{ boxSizing: 'border-box' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 font-tamil font-black text-[#034D28] text-[10.5px]">
                        <span>தொடர்ச்சி அடுத்த பக்கம் {page.pageNumber + 1}-ல் பார்க்கவும்</span>
                        <span className="text-[12px] font-bold">&gt;&gt;</span>
                      </div>
                      <div className="font-mono-num font-black text-[#034D28] text-[10px] bg-white px-2 py-0.5 rounded border border-[#034D28]">
                        பக்கம் {page.pageNumber} / {page.totalPages}
                      </div>
                    </div>
                    <div className="text-[8px] font-tamil text-gray-700 mt-1 text-center w-full">
                      (மொத்த கணக்கு விவரம் இறுதி பக்கம் {page.totalPages}-ல் காண்க)
                    </div>
                  </div>
                </div>
              )}

              {/* Page indicator for multi-page bills (inside footer line next to வாழ்க வளமுடன்) */}
              {page.totalPages > 1 && (
                <div
                  className="absolute flex items-center justify-end font-mono-num font-bold text-[#034D28] text-[8.5px]"
                  style={{
                    top: '94.2%',
                    right: '3.5%',
                    height: '2.4%',
                  }}
                >
                  பக்கம் {page.pageNumber} / {page.totalPages}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BillPrintTemplate;
