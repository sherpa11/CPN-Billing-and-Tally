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
 * 4. Fixed A5 Portrait geometry (148mm × 210mm) - prints on exactly ONE sheet for normal bills (1-20 items).
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

// Helper to get adaptive row layout parameters inside the vegetable table area
const getAdaptiveOverlayLayout = (itemCount, isSupplier = false) => {
  if (itemCount <= 5) {
    return {
      rowHeightPercent: 4.6,
      fontSizeParticulars: 'text-[15px] leading-tight font-bold',
      fontSizeData: 'text-[15px] font-bold',
      fontSizeAmount: 'text-[15px] font-black',
      lineHeight: 'leading-normal',
    };
  } else {
    // 6 to 10 items
    return {
      rowHeightPercent: 4.6,
      fontSizeParticulars: 'text-[13.5px] leading-tight font-bold',
      fontSizeData: 'text-[13.5px] font-bold',
      fontSizeAmount: 'text-[13.5px] font-black',
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

  const isSupplierBill = Boolean(
    bill.isPurchase ||
    bill.purchaseNumber ||
    bill.purchaseNumberFormatted ||
    bill.supplierName ||
    bill.supplier ||
    bill.billType === 'purchase'
  );

  const discount = isSupplierBill ? 0 : (bill.discount || 0);

  const varavu =
    bill.varavu !== undefined && bill.varavu !== null
      ? bill.varavu
      : bill.cashReceived !== undefined && bill.cashReceived !== null
      ? bill.cashReceived
      : bill.cashPaid || 0;

  const closingBalance =
    bill.closingBalance !== undefined && bill.closingBalance !== null
      ? bill.closingBalance
      : Math.round((total - discount - varavu) * 100) / 100;

  // Multi-page splitting logic (10 items fit per page cleanly)
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

  // Resolved party name and contact (strictly isolated: customer info for customer bills, supplier info for supplier bills)
  const partyName = isSupplierBill
    ? bill.supplierName || bill.supplier?.name || ''
    : bill.customerName || bill.customer?.name || '';

  const partyPhone = isSupplierBill
    ? bill.supplierPhone || bill.supplier?.phone || bill.supplier?.mobile || ''
    : bill.customerPhone || bill.customer?.phone || bill.customer?.mobile || '';

  const billDateFormatted = formatDate(bill.billDate || bill.purchaseDate || bill.date || bill.createdAt);

  return (
    <div id="printable-bill" style={{ margin: 0, padding: 0 }}>
      {pages.map((page, pIdx) => {
        const layout = getAdaptiveOverlayLayout(page.items.length, isSupplierBill);
        const tableTop = 29.8;

        return (
          <div
            key={`page-${pIdx}`}
            className={`cpn-a5-bill select-none shadow-xl mb-6 last:mb-0 border border-gray-300 rounded-sm ${
              !page.isFinalPage ? 'cpn-a5-bill-page-break' : ''
            }`}
            style={{
              position: 'relative',
              width: '148mm',
              maxWidth: '148mm',
              height: '210mm',
              maxHeight: '210mm',
              margin: '0 auto',
              padding: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
            }}
          >
            {/* ============================================================== */}
            {/* BASE LAYER: ACTUAL ORIGINAL BLANK CPN BILL IMAGE TEMPLATE      */}
            {/* Supplier: cpn_supplier_bill_template.jpg (A5: 148 × 210 mm)    */}
            {/* Customer: cpn_blank_bill_template.jpg (A5: 148 × 210 mm)       */}
            {/* Both use the approved exact A5 uploaded bill leaf template     */}
            {/* ============================================================== */}
            <img
              src={isSupplierBill ? '/cpn_supplier_bill_template.jpg' : '/cpn_blank_bill_template.jpg'}
              alt={isSupplierBill ? 'CPN Supplier Bill Template' : 'CPN Vegetables Bill Template'}
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
              {/* 1. PARTY NAME (திரு: - Supplier or Customer) */}
              <div
                className="absolute flex items-center font-black text-black font-tamil text-[18px] leading-none truncate pl-1 pr-2"
                style={{
                  left: '10.0%',
                  top: '22.0%',
                  width: '54.5%',
                  height: '3.4%',
                  boxSizing: 'border-box',
                }}
                title={partyName}
              >
                <span className="truncate">{partyName}</span>
                {partyPhone && (
                  <span className="font-mono-num font-bold text-gray-800 text-[13px] ml-1.5 flex-shrink-0">
                    ({partyPhone})
                  </span>
                )}
                {page.pageNumber > 1 && (
                  <span className="text-[12px] font-bold text-[#034D28] ml-2 flex-shrink-0">
                    (பக்கம் {page.pageNumber})
                  </span>
                )}
              </div>

              {/* 2. DATE (தேதி : - Date of Bill) */}
              <div
                className="absolute flex items-center justify-center font-mono-num font-bold text-gray-950 text-[15px] leading-none"
                style={{
                  left: '74.5%',
                  top: '22.0%',
                  width: '23.5%',
                  height: '3.4%',
                  boxSizing: 'border-box',
                }}
              >
                {billDateFormatted}
              </div>

              {/* 3. VEGETABLE ENTRIES (inside 5-column table body) */}
              {page.items.map((item, idx) => {
                const itemAmount =
                  item.amount !== undefined && item.amount !== null
                    ? item.amount
                    : item.debit !== undefined && item.debit !== null
                    ? item.debit
                    : (item.rate || 0) * (item.weight || 0);

                const rowTop = tableTop + idx * layout.rowHeightPercent;

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
                    {/* Col 1: விலை (Rate) */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '1.54%',
                        width: '13.91%',
                        height: '100%',
                      }}
                    >
                      {item.rate > 0 ? formatNumber(item.rate) : ''}
                    </div>

                    {/* Col 2: பொருள் (Particulars - Tamil Name) */}
                    <div
                      className={`flex items-center text-left pl-2.5 pr-1 font-tamil font-bold text-gray-950 truncate ${layout.fontSizeParticulars}`}
                      style={{
                        position: 'absolute',
                        left: '15.45%',
                        width: '35.53%',
                        height: '100%',
                      }}
                    >
                      <span className="truncate">{getVegetableDisplayName(item)}</span>
                    </div>

                    {/* Col 3: பை (Bag) */}
                    <div
                      className={`flex items-center justify-center font-mono-num font-bold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '50.98%',
                        width: '10.68%',
                        height: '100%',
                      }}
                    >
                      {item.bag > 0 ? item.bag : ''}
                    </div>

                    {/* Col 4: எடை (Weight) */}
                    <div
                      className={`flex items-center justify-end pr-2 font-mono-num font-semibold text-gray-950 ${layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '61.66%',
                        width: '12.78%',
                        height: '100%',
                      }}
                    >
                      {item.weight > 0 ? formatNumber(item.weight) : ''}
                    </div>

                    {/* Col 5: தொகை (Amount) */}
                    <div
                      className={`flex items-center justify-end pr-3 font-mono-num font-black text-gray-950 ${layout.fontSizeAmount || layout.fontSizeData}`}
                      style={{
                        position: 'absolute',
                        left: '74.44%',
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
                  {/* Row 1: இன்றைய மொத்தம் (Today's Total) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[15px]"
                    style={{
                      left: '66.85%',
                      top: '76.17%',
                      width: '31.18%',
                      height: '2.64%',
                    }}
                  >
                    {formatCurrency(todayTotal)}
                  </div>

                  {/* Row 2: முன் பாக்கி Date */}
                  {previousBalanceDateFormatted && (
                    isSupplierBill ? (
                      /* In supplier template, முன் பாக்கி : (தேதி :   ) is printed; place date in the blank slot */
                      <div
                        className="absolute flex items-center justify-center font-mono-num font-bold text-gray-950 text-[12.5px]"
                        style={{
                          left: '46.5%',
                          top: '78.81%',
                          width: '16.0%',
                          height: '3.03%',
                        }}
                      >
                        {previousBalanceDateFormatted}
                      </div>
                    ) : (
                      /* In customer template, place date cleanly in the pre-printed slot */
                      <div
                        className="absolute flex items-center justify-center font-mono-num font-bold text-gray-950 text-[12.5px]"
                        style={{
                          left: '46.5%',
                          top: '78.81%',
                          width: '16.0%',
                          height: '3.03%',
                        }}
                      >
                        {previousBalanceDateFormatted}
                      </div>
                    )
                  )}

                  {/* Row 2: முன் பாக்கி (Previous Balance) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-bold text-black text-[15px]"
                    style={{
                      left: '66.85%',
                      top: '78.81%',
                      width: '31.18%',
                      height: '3.03%',
                    }}
                  >
                    {formatCurrency(previousBalance)}
                  </div>

                  {/* Row 3: மொத்தம் (Total) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[16px]"
                    style={{
                      left: '66.85%',
                      top: '81.84%',
                      width: '31.18%',
                      height: '3.32%',
                    }}
                  >
                    {formatCurrency(total)}
                  </div>

                  {/* Row 4: செலுத்திய தொகை (Amount Paid) Label & Discount Note */}
                  {!isSupplierBill && (
                    <div
                      className="absolute flex items-center justify-between pl-2.5 pr-2"
                      style={{
                        left: '16.0%',
                        top: '85.25%',
                        width: '50.4%',
                        height: '3.32%',
                        backgroundColor: '#ffffff',
                        zIndex: 2,
                      }}
                    >
                      <span
                        className={`font-tamil font-black text-black whitespace-nowrap select-none leading-none ${
                          discount > 0
                            ? 'text-[13px] sm:text-[13.5px] tracking-tight'
                            : 'font-tamil font-black text-black text-[17px] sm:text-[18px] tracking-normal'
                        }`}
                      >
                        செலுத்திய தொகை :
                      </span>
                      {discount > 0 && (
                        <span className="font-mono-num font-bold text-amber-900 text-[11.5px] sm:text-[12px] whitespace-nowrap ml-1 flex-shrink-0">
                          (தள்ளுபடி: ₹{formatCurrency(discount)})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 4: செலுத்திய தொகை (Amount Paid) Value */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[18px]"
                    style={{
                      left: '66.85%',
                      top: '85.16%',
                      width: '31.18%',
                      height: '3.51%',
                      zIndex: 2,
                    }}
                  >
                    {formatCurrency(varavu)}
                  </div>

                  {/* Row 5: இறுதி மொத்தம் (Closing Balance) Amount */}
                  <div
                    className="absolute flex items-center justify-end pr-3 font-mono-num font-black text-black text-[18px]"
                    style={{
                      left: '66.85%',
                      top: '88.67%',
                      width: '31.18%',
                      height: '3.91%',
                    }}
                  >
                    {formatCurrency(closingBalance)}
                  </div>
                </>
              ) : (
                /* Multi-page continuation prompt on non-final pages */
                <div
                  className="absolute"
                  style={{
                    left: '1.54%',
                    top: '76.17%',
                    width: '96.49%',
                    height: '16.41%',
                    backgroundColor: '#ffffff',
                    zIndex: 10,
                  }}
                >
                  <div
                    className="w-full h-full flex flex-col justify-center items-center px-4 bg-emerald-50/90 border-2 border-[#034D28] rounded-md"
                    style={{ boxSizing: 'border-box' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 font-tamil font-black text-[#034D28] text-[14px]">
                        <span>தொடர்ச்சி அடுத்த பக்கம் {page.pageNumber + 1}-ல் பார்க்கவும்</span>
                        <span className="text-[15px] font-bold">&gt;&gt;</span>
                      </div>
                      <div className="font-mono-num font-black text-[#034D28] bg-white px-2 py-0.5 rounded border border-[#034D28] text-[13px]">
                        பக்கம் {page.pageNumber} / {page.totalPages}
                      </div>
                    </div>
                    <div className="font-tamil text-gray-700 mt-0.5 text-center w-full text-[11px]">
                      (மொத்த கணக்கு விவரம் இறுதி பக்கம் {page.totalPages}-ல் காண்க)
                    </div>
                  </div>
                </div>
              )}

              {/* Page indicator for multi-page bills (inside footer line next to வாழ்க வளமுடன்) */}
              {page.totalPages > 1 && (
                <div
                  className="absolute flex items-center justify-end font-mono-num font-bold text-[#034D28] text-[11px]"
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
