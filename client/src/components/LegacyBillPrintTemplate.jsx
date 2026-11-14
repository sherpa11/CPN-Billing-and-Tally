import React from 'react';
import { formatCurrency, formatNumber } from '../utils/math';

/**
 * High-fidelity A5 print bill template reproducing the traditional wholesale vegetable market bill.
 * Sized strictly for A5 paper (148mm × 210mm portrait, printable area 138mm wide).
 * Uses exact dark green theme (#034D28), Tamil headers, Lakshmi/CPN logo, 6-column table,
 * totals, previous balance, cash received, closing balance, and footer.
 */
export const BillPrintTemplate = ({ bill, settings, minRows = 8, masterVegetables = [] }) => {
  if (!bill) return null;

  const currentSettings = settings || {
    shopName: 'CPN VEGETABLES',
    tamilHeaderInvocation: 'உ',
    tamilHeaderDeity: 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை',
    tamilBusinessDescription: 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி',
    address: '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.',
    contactNumbers: ['97152 67025', '97882 29090'],
    footerText: 'வாழ்க வளமுடன்',
    logoUrl: '/cpn_logo.png',
  };

  const items = bill.items || [];
  const emptyRowsCount = Math.max(0, minRows - items.length);

  // Format date as DD/MM/YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper to determine display name in PARTICULARS (பொருள்):
  // 1. Direct item.tamilName (stored directly on item)
  // 2. Populated item.vegetable.tamilName
  // 3. Matched from masterVegetables list by ID or English name
  // 4. Fallback to English name (item.vegetable.name or item.particulars)
  const getVegetableDisplayName = (item) => {
    if (item.tamilName && item.tamilName.trim()) {
      return item.tamilName.trim();
    }
    if (item.vegetable && typeof item.vegetable === 'object' && item.vegetable.tamilName && item.vegetable.tamilName.trim()) {
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
          (v) => (v.name && v.name.trim().toLowerCase() === norm) || (v.normalizedName && v.normalizedName === norm)
        );
        if (match && match.tamilName && match.tamilName.trim()) {
          return match.tamilName.trim();
        }
      }
    }
    if (item.vegetable && typeof item.vegetable === 'object' && item.vegetable.name && item.vegetable.name.trim()) {
      return item.vegetable.name.trim();
    }
    return item.particulars || 'Vegetables';
  };

  return (
    <div
      id="printable-bill"
      className="cpn-a5-bill bg-white text-[#034D28] font-sans mx-auto p-2.5 border-[2px] border-[#034D28] rounded-md select-none"
      style={{
        width: '138mm',
        maxWidth: '138mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Invocation Header */}
      <div className="relative flex justify-between items-start mb-1.5 px-0.5">
        {/* Left: Shop Logo with Lakshmi / Amman and CPN badge */}
        <div className="w-16 h-22 flex-shrink-0 flex items-center justify-center">
          <img
            src={currentSettings.logoUrl || '/cpn_logo.png'}
            alt="CPN Logo"
            className="w-full h-full object-contain max-h-22"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>

        {/* Center: Deity invocation & Shop identity */}
        <div className="flex-1 text-center px-1">
          {/* Invocation 'உ' */}
          <div className="text-xs font-bold tracking-wide inline-block border-b border-[#034D28] pb-[1px] leading-none mb-0.5">
            {currentSettings.tamilHeaderInvocation || 'உ'}
          </div>

          {/* Deity subtitle */}
          <div className="text-[10.5px] font-bold font-tamil text-[#034D28] tracking-normal mb-0.5">
            {currentSettings.tamilHeaderDeity || 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை'}
          </div>

          {/* Framed CPN VEGETABLES Box */}
          <div className="inline-block border-[1.5px] border-[#034D28] rounded-lg px-3 py-0.5 my-0.5 bg-white shadow-2xs">
            <h1 className="text-xl font-black tracking-wide text-[#034D28] uppercase font-serif">
              {currentSettings.shopName || 'CPN VEGETABLES'}
            </h1>
          </div>

          {/* Tamil Business Description */}
          <div className="text-[11.5px] font-bold font-tamil text-[#034D28] mt-0.5">
            {currentSettings.tamilBusinessDescription || 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி'}
          </div>

          {/* Address */}
          <div className="text-[10px] font-semibold font-tamil text-[#034D28] mt-0.5">
            {currentSettings.address || '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.'}
          </div>
        </div>

        {/* Right: Phone Numbers & Bill Number */}
        <div className="text-right flex-shrink-0 text-[11px] font-bold space-y-0.5 pt-0.5 font-mono-num text-[#034D28]">
          {(currentSettings.contactNumbers || ['97152 67025', '97882 29090']).map((num, idx) => (
            <div key={idx} className="flex items-center justify-end gap-1">
              <svg className="w-3 h-3 text-[#034D28]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" />
              </svg>
              <span>{num}</span>
            </div>
          ))}
          {bill.billNumberFormatted && (
            <div className="mt-1 text-[10px] font-black text-[#034D28] bg-emerald-50 px-1.5 py-0.5 rounded border border-[#034D28] inline-block">
              எண்: {bill.billNumberFormatted}
            </div>
          )}
        </div>
      </div>

      {/* Customer Name & Date Header Bar */}
      <div className="border-t-[1.5px] border-b-[1.5px] border-[#034D28] py-1 px-2 flex justify-between items-center text-xs font-bold my-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="font-tamil font-extrabold text-[#034D28] flex-shrink-0">திரு:</span>
          <span className="text-black font-semibold text-xs border-b border-dotted border-gray-400 flex-1 pl-1 truncate">
            {bill.customerName || bill.customer?.name}
            {bill.customerPhone ? ` (${bill.customerPhone})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pl-3 flex-shrink-0">
          <span className="font-tamil font-extrabold text-[#034D28]">தேதி :</span>
          <span className="text-black font-bold font-mono-num border-b border-dotted border-gray-400 pl-1 min-w-[75px] text-right">
            {formatDate(bill.billDate)}
          </span>
        </div>
      </div>

      {/* 6-Column Main Billing Table */}
      <table className="print-table w-full border-collapse border-[1.5px] border-[#034D28] text-xs my-1">
        <thead>
          <tr className="border-b-[1.5px] border-[#034D28] bg-emerald-50/60 text-[#034D28] font-extrabold text-center uppercase tracking-wider text-[10px]">
            <th className="border-r-[1.5px] border-[#034D28] py-1 px-1 w-[12%]">RATE</th>
            <th className="border-r-[1.5px] border-[#034D28] py-1 px-1.5 text-left w-[40%]">PARTICULARS</th>
            <th className="border-r-[1.5px] border-[#034D28] py-1 px-1 w-[10%]">BAG</th>
            <th className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right w-[12%]">WEIGHT</th>
            <th className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right w-[13%]">DEBIT</th>
            <th className="py-1 px-1 text-right w-[13%]">CREDIT</th>
          </tr>
        </thead>
        <tbody>
          {/* Active vegetable rows */}
          {items.map((item, idx) => (
            <tr
              key={idx}
              className="border-b border-[#034D28]/30 hover:bg-emerald-50/20 text-[11px] font-semibold text-black leading-tight"
            >
              <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-center font-mono-num">
                {item.rate > 0 ? formatNumber(item.rate) : ''}
              </td>
              <td className="border-r-[1.5px] border-[#034D28] py-1 px-1.5 text-left font-medium">
                <span className="font-bold text-gray-950 font-tamil leading-tight">
                  {getVegetableDisplayName(item)}
                </span>
              </td>
              <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-center font-mono-num font-bold">
                {item.bag > 0 ? item.bag : ''}
              </td>
              <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num font-semibold">
                {item.weight > 0 ? formatNumber(item.weight) : ''}
              </td>
              <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num font-bold text-gray-950">
                {item.debit > 0 ? formatCurrency(item.debit) : ''}
              </td>
              <td className="py-1 px-1 text-right font-mono-num font-semibold text-gray-800">
                {item.credit > 0 ? formatCurrency(item.credit) : ''}
              </td>
            </tr>
          ))}

          {/* Empty filler rows to maintain traditional bill format on A5 */}
          {Array.from({ length: emptyRowsCount }).map((_, i) => (
            <tr key={`empty-${i}`} className="border-b border-[#034D28]/25 h-6 text-[10px]">
              <td className="border-r-[1.5px] border-[#034D28]">&nbsp;</td>
              <td className="border-r-[1.5px] border-[#034D28]">&nbsp;</td>
              <td className="border-r-[1.5px] border-[#034D28]">&nbsp;</td>
              <td className="border-r-[1.5px] border-[#034D28]">&nbsp;</td>
              <td className="border-r-[1.5px] border-[#034D28]">&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}

          {/* TOTAL ROW */}
          <tr className="border-t-[1.5px] border-b-[1.5px] border-[#034D28] bg-emerald-50/70 font-extrabold text-[#034D28] text-[11px]">
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-center">&nbsp;</td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1.5 text-center tracking-widest font-black text-xs">
              TOTAL
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-center font-mono-num font-black">
              {bill.totalBag > 0 ? bill.totalBag : ''}
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num font-black">
              {bill.totalWeight > 0 ? formatNumber(bill.totalWeight) : ''}
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num font-black">
              {formatCurrency(bill.totalDebit)}
            </td>
            <td className="py-1 px-1 text-right font-mono-num font-black">
              {bill.totalCredit > 0 ? formatCurrency(bill.totalCredit) : ''}
            </td>
          </tr>

          {/* PREVIOUS BALANCE ROW */}
          <tr className="border-b border-[#034D28] font-bold text-[11px]">
            <td colSpan={4} className="border-r-[1.5px] border-[#034D28] py-1 px-2 text-left tracking-wider uppercase text-[#034D28]">
              PREVIOUS BALANCE
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num font-bold text-black">
              {formatCurrency(bill.previousBalance)}
            </td>
            <td className="py-1 px-1 text-right font-mono-num text-gray-400">-</td>
          </tr>

          {/* CASH RECEIVED ROW */}
          <tr className="border-b border-[#034D28] font-bold text-[11px]">
            <td colSpan={4} className="border-r-[1.5px] border-[#034D28] py-1 px-2 text-left tracking-wider uppercase text-[#034D28]">
              CASH RECEIVED
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1 px-1 text-right font-mono-num text-gray-400">-</td>
            <td className="py-1 px-1 text-right font-mono-num font-bold text-black">
              {bill.cashReceived > 0 ? formatCurrency(bill.cashReceived) : '0.00'}
            </td>
          </tr>

          {/* CLOSING BALANCE ROW */}
          <tr className="border-b-[1.5px] border-[#034D28] bg-emerald-50/50 font-extrabold text-[12px] text-[#034D28]">
            <td colSpan={4} className="border-r-[1.5px] border-[#034D28] py-1.5 px-2 text-left tracking-wider uppercase font-black">
              CLOSING BALANCE
            </td>
            <td className="border-r-[1.5px] border-[#034D28] py-1.5 px-1 text-right font-mono-num font-black text-black text-[13px]">
              {formatCurrency(bill.closingBalance)}
            </td>
            <td className="py-1.5 px-1 text-right font-mono-num text-gray-400">-</td>
          </tr>
        </tbody>
      </table>

      {/* Footer Blessing */}
      <div className="text-center py-1 mt-0.5">
        <p className="font-tamil font-extrabold text-sm text-[#034D28] tracking-wider">
          {currentSettings.footerText || 'வாழ்க வளமுடன்'}
        </p>
      </div>
    </div>
  );
};

export default BillPrintTemplate;
