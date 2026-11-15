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
      rowHeightPercent: 4.2,
      fontSizeParticulars: 'text-[11px] leading-tight font-bold',
      fontSizeData: 'text-[11px] font-bold',
      lineHeight: 'leading-normal',
    };
  } else if (itemCount <= 10) {
    return {
      rowHeightPercent: 3.5,
      fontSizeParticulars: 'text-[10px] leading-tight font-bold',
      fontSizeData: 'text-[10px] font-bold',
      lineHeight: 'leading-normal',
    };
  } else if (itemCount <= 15) {
    return {
      rowHeightPercent: 2.8,
      fontSizeParticulars: 'text-[9px] leading-tight font-bold',
      fontSizeData: 'text-[9px] font-semibold',
      lineHeight: 'leading-snug',
    };
  } else {
    // 16 to 20 items
    return {
      rowHeightPercent: 2.2,
      fontSizeParticulars: 'text-[8px] leading-none font-bold',
      fontSizeData: 'text-[8px] leading-none font-semibold',
      lineHeight: 'leading-none',
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

  // Multi-page splitting logic for A6 (up to 20 items fit on 1 page)
  const MAX_ITEMS_PAGE_1 = 15;
  const isMultiPage = activeItems.length > 20;
  const pages = [];

  if (!isMultiPage) {
    pages.push({
      pageNumber: 1,
      totalPages: 1,
      items: activeItems,
      isFinalPage: true,
    });
  } else {
    // Chunk into 2 continuation pages
    const page1Items = activeItems.slice(0, MAX_ITEMS_PAGE_1);
    const page2Items = activeItems.slice(MAX_ITEMS_PAGE_1);
    pages.push({
      pageNumber: 1,
      totalPages: 2,
      items: page1Items,
      isFinalPage: false,
    });
    pages.push({
      pageNumber: 2,
      totalPages: 2,
      items: page2Items,
      isFinalPage: true,
    });
  }

  // Table body start and end Y coordinates as percentages of 1024px canvas
  const TABLE_TOP_PERCENT = 30.86; // Y = 316px (bottom of header row)

  return (
    <div id="printable-bill" style={{ margin: 0, padding: 0 }}>
      {pages.map((page, pIdx) => {
        const layout = getAdaptiveOverlayLayout(page.items.length);

        return (
          <div
            key={`page-${pIdx}`}
            className={`cpn-a6-bill select-none shadow-md ${!page.isFinalPage ? 'cpn-a6-bill-page-break' : ''}`}
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
              {/* 1. CUSTOMER NAME (on திரு: underline) */}
              <div
                className="absolute flex items-center font-bold text-gray-950 font-tamil text-[10px] truncate pl-0.5 pr-2"
                style={{
                  left: '9.8%',
                  top: '22.8%',
                  width: '58.0%',
                  height: '3.2%',
                }}
                title={bill.customerName || bill.customer?.name}
              >
                <span className="truncate">{bill.customerName || bill.customer?.name || ''}</span>
                {bill.customerPhone && (
                  <span className="font-mono-num font-semibold text-gray-800 text-[9px] ml-1.5 flex-shrink-0">
                    ({bill.customerPhone})
                  </span>
                )}
                {page.pageNumber > 1 && (
                  <span className="text-[8.5px] font-bold text-[#034D28] ml-2 flex-shrink-0">
                    (தொடர்ச்சி)
                  </span>
                )}
              </div>

              {/* 3. DATE (on தேதி : underline) */}
              <div
                className="absolute flex items-center justify-center font-mono-num font-bold text-gray-950 text-[10px]"
                style={{
                  left: '75.2%',
                  top: '22.8%',
                  width: '22.5%',
                  height: '3.2%',
                }}
              >
                {formatDate(bill.billDate)}
              </div>

              {/* 4. VEGETABLE ENTRIES (inside 5-column table body) */}
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
                    {/* Col 1: விலை (Rate) - 1.54% to 14.75% */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '1.54%',
                        width: '13.20%',
                        height: '100%',
                      }}
                    >
                      {item.rate > 0 ? formatNumber(item.rate) : ''}
                    </div>

                    {/* Col 2: பொருள் (Particulars - Tamil Name) - 14.75% to 50.98% */}
                    <div
                      className={`flex items-center text-left pl-2 pr-1 font-tamil font-bold text-gray-950 truncate ${layout.fontSizeParticulars}`}
                      style={{
                        position: 'absolute',
                        left: '14.75%',
                        width: '36.24%',
                        height: '100%',
                      }}
                    >
                      <span className="truncate">{getVegetableDisplayName(item)}</span>
                    </div>

                    {/* Col 3: பை (Bag) - 50.98% to 61.66% */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '50.98%',
                        width: '10.67%',
                        height: '100%',
                      }}
                    >
                      {item.bag > 0 ? item.bag : ''}
                    </div>

                    {/* Col 4: எடை (Weight) - 61.66% to 74.58% */}
                    <div
                      className={`flex items-center justify-end pr-2 font-mono-num font-semibold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '61.66%',
                        width: '12.92%',
                        height: '100%',
                      }}
                    >
                      {item.weight > 0 ? formatNumber(item.weight) : ''}
                    </div>

                    {/* Col 5: தொகை (Amount) - 74.58% to 98.46% */}
                    <div
                      className={`flex items-center justify-end pr-3 font-mono-num font-black text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '74.58%',
                        width: '23.88%',
                        height: '100%',
                      }}
                    >
                      {itemAmount > 0 ? formatCurrency(itemAmount) : ''}
                    </div>
                  </div>
                );
              })}

              {/* 5. SUMMARY SECTION AMOUNTS (mapped into the blank amount cells) */}
              {page.isFinalPage ? (
                <>
                  {/* Row 1: இன்றைய மொத்தம் (Today's Total) Amount - Y=771..804px (75.29%..78.52%) */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[10px]"
                    style={{
                      left: '66.43%',
                      top: '75.29%',
                      width: '32.03%',
                      height: '3.22%',
                    }}
                  >
                    {formatCurrency(todayTotal)}
                  </div>

                  {/* Row 2: முன் பாக்கி Date on underline - X=305..440px (42.84%..61.80%) */}
                  <div
                    className="absolute flex items-center justify-center font-mono-num font-bold text-[#034D28] text-[8.5px]"
                    style={{
                      left: '42.84%',
                      top: '78.52%',
                      width: '18.96%',
                      height: '3.22%',
                    }}
                  >
                    {previousBalanceDateFormatted}
                  </div>

                  {/* Row 2: முன் பாக்கி (Previous Balance) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-bold text-black text-[10px]"
                    style={{
                      left: '66.43%',
                      top: '78.52%',
                      width: '32.03%',
                      height: '3.22%',
                    }}
                  >
                    {formatCurrency(previousBalance)}
                  </div>

                  {/* Row 3: மொத்தம் (Total) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[10.5px]"
                    style={{
                      left: '66.43%',
                      top: '81.74%',
                      width: '32.03%',
                      height: '3.42%',
                    }}
                  >
                    {formatCurrency(total)}
                  </div>

                  {/* Row 4: தள்ளுபடி (Discount) note next to ரொக்கம் பெற்றது if present */}
                  {discount > 0 && (
                    <div
                      className="absolute flex items-center justify-end pr-1 font-mono-num font-bold text-amber-900 text-[7.5px] whitespace-nowrap"
                      style={{
                        left: '44.5%',
                        top: '85.16%',
                        width: '21.5%',
                        height: '3.42%',
                      }}
                    >
                      (தள்ளுபடி: {formatCurrency(discount)})
                    </div>
                  )}

                  {/* Row 4: ரொக்கம் பெற்றது / வரவு (Cash Received) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-bold text-black text-[10px]"
                    style={{
                      left: '66.43%',
                      top: '85.16%',
                      width: '32.03%',
                      height: '3.42%',
                    }}
                  >
                    {varavu > 0 ? formatCurrency(varavu) : '0.00'}
                  </div>

                  {/* Row 5: இறுதி மொத்தம் / மொத்த பாக்கி (Closing Balance) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[11px]"
                    style={{
                      left: '66.43%',
                      top: '88.57%',
                      width: '32.03%',
                      height: '4.50%',
                    }}
                  >
                    {formatCurrency(closingBalance)}
                  </div>
                </>
              ) : (
                /* Multi-page continuation prompt on Page 1 */
                <div
                  className="absolute flex items-center justify-between px-3 bg-white/95 border-t border-[#034D28]"
                  style={{
                    left: '1.54%',
                    top: '75.29%',
                    width: '96.92%',
                    height: '17.78%',
                  }}
                >
                  <span className="font-tamil font-black text-[9px] text-[#034D28]">
                    தொடர்ச்சி அடுத்த பக்கம் 2-ல் பார்க்கவும் &gt;&gt;
                  </span>
                  <span className="font-mono-num font-bold text-[8px] text-[#034D28]">
                    பக்கம் 1 / 2
                  </span>
                </div>
              )}

              {/* Page indicator for multi-page bills (near footer) */}
              {page.totalPages > 1 && (
                <div
                  className="absolute right-2 flex items-center font-mono-num font-bold text-[#034D28] text-[7px]"
                  style={{
                    bottom: '1.5%',
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
