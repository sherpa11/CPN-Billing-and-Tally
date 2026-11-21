import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  Users,
  Carrot,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, formatNumber } from '../utils/math';

export const Reports = () => {
  const { settings = {} } = useSettings() || {};
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Tab-specific isolated states to prevent any data-shape collisions or render crashes
  const [dailyData, setDailyData] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [outstandingData, setOutstandingData] = useState(null);
  const [vegetablesData, setVegetablesData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      if (activeTab === 'daily') {
        const res = await api.get(`/reports/daily?date=${selectedDate}`);
        if (res?.success) setDailyData(res);
      } else if (activeTab === 'sales') {
        const res = await api.get(`/reports/sales-summary?startDate=${startDate}&endDate=${endDate}`);
        if (res?.success) setSalesData(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'outstanding') {
        const res = await api.get('/reports/outstanding');
        if (res?.success) setOutstandingData(res);
      } else if (activeTab === 'vegetables') {
        const res = await api.get(`/reports/vegetables?startDate=${startDate}&endDate=${endDate}`);
        if (res?.success) setVegetablesData(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'monthly') {
        const res = await api.get('/reports/monthly');
        if (res?.success) setMonthlyData(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('[Reports] Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, selectedDate, startDate, endDate]);

  // Handle dedicated A4 report printing lifecycle
  const handlePrintReport = () => {
    // 1. Reset all container horizontal scrolls so nothing is printed clipped off to the left
    document.querySelectorAll('.overflow-x-auto, .overflow-auto, main, #root').forEach((el) => {
      el.scrollLeft = 0;
    });

    // 2. Inject landscape page rule for reports
    let styleEl = document.getElementById('report-print-page-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'report-print-page-style';
      styleEl.innerHTML = `@page { size: A4 landscape; margin: 8mm 10mm 10mm 10mm; }`;
      document.head.appendChild(styleEl);
    }

    document.body.classList.add('print-report-active');
    const cleanup = () => {
      document.body.classList.remove('print-report-active');
      const injected = document.getElementById('report-print-page-style');
      if (injected) injected.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  // Keyboard shortcut Ctrl+P / window print lifecycle hook
  useEffect(() => {
    const handleBeforePrint = () => {
      document.querySelectorAll('.overflow-x-auto, .overflow-auto, main, #root').forEach((el) => {
        el.scrollLeft = 0;
      });
      let styleEl = document.getElementById('report-print-page-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'report-print-page-style';
        styleEl.innerHTML = `@page { size: A4 landscape; margin: 8mm 10mm 10mm 10mm; }`;
        document.head.appendChild(styleEl);
      }
      document.body.classList.add('print-report-active');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-report-active');
      const injected = document.getElementById('report-print-page-style');
      if (injected) injected.remove();
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-report-active');
      const injected = document.getElementById('report-print-page-style');
      if (injected) injected.remove();
    };
  }, []);

  const exportCSV = (filename, rows) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((e) => Object.values(e).map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safely normalized arrays and objects
  const dailyBills = Array.isArray(dailyData?.bills) ? dailyData.bills : [];
  const dailySummary = dailyData?.summary || {
    totalBills: 0,
    totalBags: 0,
    totalWeight: 0,
    totalDebit: 0,
    totalCashCollected: 0,
  };
  const salesList = Array.isArray(salesData) ? salesData : [];
  const outstandingCustomers = Array.isArray(outstandingData?.data) ? outstandingData.data : [];
  const vegList = Array.isArray(vegetablesData) ? vegetablesData : [];
  const monthlyList = Array.isArray(monthlyData) ? monthlyData : [];

  // Filtered customer outstanding list with search support
  const filteredOutstanding = outstandingCustomers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const term = customerSearch.trim().toLowerCase();
    return c.name?.toLowerCase().includes(term);
  });

  const sumOldBalance = filteredOutstanding.reduce((acc, c) => acc + (c.oldBalance || 0), 0);
  const sumLatestBillTotal = filteredOutstanding.reduce((acc, c) => acc + (c.latestBillTotal || 0), 0);
  const sumTotalOutstanding = filteredOutstanding.reduce((acc, c) => acc + (c.totalOutstanding || 0), 0);
  const sumPaid = filteredOutstanding.reduce((acc, c) => acc + (c.paid || 0), 0);
  const sumNewBalance = filteredOutstanding.reduce((acc, c) => acc + (c.newBalance || 0), 0);

  // Universal Direct CSV Download handler for currently active report tab
  const handleDownloadCsv = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (activeTab === 'daily') {
      exportCSV(
        `CPN_Daily_Report_${selectedDate}`,
        dailyBills.map((b) => ({
          BillNo: b.billNumberFormatted,
          Customer: b.customerName,
          Bags: b.totalBag,
          Weight: b.totalWeight,
          Debit: b.totalDebit,
          Credit: b.totalCredit,
          CashReceived: b.cashReceived,
          ClosingBalance: b.closingBalance,
        }))
      );
    } else if (activeTab === 'sales') {
      exportCSV(
        `CPN_Datewise_Sales_${startDate}_to_${endDate}`,
        salesList.map((r) => ({
          Date: r.date,
          BillsCount: r.billCount,
          Bags: r.totalBags,
          WeightKg: r.totalWeight,
          TotalDebit: r.totalDebit,
          CashReceived: r.cashReceived,
        }))
      );
    } else if (activeTab === 'outstanding') {
      exportCSV(
        `CPN_Customer_Outstanding_${todayStr}`,
        filteredOutstanding.map((c, idx) => ({
          SNo: idx + 1,
          CustomerName: c.name,
          OldBalance: c.oldBalance || 0,
          LatestBillTotal: c.latestBillTotal || 0,
          TotalOutstanding: c.totalOutstanding || 0,
          Paid: c.paid || 0,
          NewBalance: c.newBalance || 0,
        }))
      );
    } else if (activeTab === 'vegetables') {
      exportCSV(
        `CPN_Vegetable_Movement_${startDate}_to_${endDate}`,
        vegList.map((v) => ({
          Vegetable: v.vegetable,
          BagsSold: v.totalBags,
          WeightKg: v.totalWeight,
          AvgRatePerKg: v.avgRate,
          TotalRevenue: v.totalRevenue,
        }))
      );
    } else if (activeTab === 'monthly') {
      exportCSV(
        `CPN_Monthly_Summary_${todayStr}`,
        monthlyList.map((m) => ({
          Month: m.month,
          BillsCount: m.billCount,
          TotalDebit: m.totalDebit,
          TotalCollection: m.totalCollection,
        }))
      );
    }
  };

  // Universal Direct PDF Download handler for all reports without opening browser print dialog
  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);

      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const todayFormatted = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // Prepare report specific columns, rows, totals, and metadata
      let title = '';
      let subtitle = '';
      let filename = `CPN_Report_${todayStr}.pdf`;
      let columns = [];
      let rowData = [];
      let totalsData = null;

      if (activeTab === 'outstanding') {
        title = 'வாடிக்கையாளர் நிலுவைத் தொகை அறிக்கை (Customer Outstanding Balance Ledger)';
        subtitle = `As of: ${todayFormatted}`;
        filename = `CPN_Customer_Outstanding_${todayStr}.pdf`;
        columns = [
          { label: '#', width: '4.5%', align: 'center' },
          { label: 'Customer Name', width: '25.5%', align: 'left', bold: true },
          { label: 'Old Balance (₹)', width: '14%', align: 'right' },
          { label: 'Latest Bill Total (₹)', width: '14%', align: 'right' },
          { label: 'Total Outstanding (₹)', width: '14%', align: 'right', bold: true, color: '#034D28' },
          { label: 'Paid (₹)', width: '14%', align: 'right', color: '#065f46' },
          { label: 'New Balance (₹)', width: '14.5%', align: 'right', bold: true, color: '#78350f', fontSize: '14px' },
        ];
        rowData = filteredOutstanding.map((c, idx) => [
          idx + 1,
          c.name || 'Unknown',
          `₹${formatCurrency(c.oldBalance)}`,
          `₹${formatCurrency(c.latestBillTotal)}`,
          `₹${formatCurrency(c.totalOutstanding)}`,
          `₹${formatCurrency(c.paid)}`,
          `₹${formatCurrency(c.newBalance)}`,
        ]);
        totalsData = [
          `TOTAL (${filteredOutstanding.length} Customers)`,
          `₹${formatCurrency(sumOldBalance)}`,
          `₹${formatCurrency(sumLatestBillTotal)}`,
          `₹${formatCurrency(sumTotalOutstanding)}`,
          `₹${formatCurrency(sumPaid)}`,
          `₹${formatCurrency(sumNewBalance)}`,
        ];
      } else if (activeTab === 'daily') {
        title = 'தினசரி விற்பனை அறிக்கை (Daily Billing Report)';
        subtitle = `Date: ${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        filename = `CPN_Daily_Report_${selectedDate}.pdf`;
        columns = [
          { label: '#', width: '4%', align: 'center' },
          { label: 'Bill No', width: '13%', align: 'center', bold: true },
          { label: 'Customer', width: '25%', align: 'left', bold: true },
          { label: 'Bags', width: '8%', align: 'right' },
          { label: 'Weight (kg)', width: '10%', align: 'right' },
          { label: 'Debit (₹)', width: '13%', align: 'right', bold: true },
          { label: 'Paid (₹)', width: '13%', align: 'right', color: '#065f46' },
          { label: 'Closing (₹)', width: '14%', align: 'right', color: '#78350f', bold: true },
        ];
        rowData = dailyBills.map((b, idx) => [
          idx + 1,
          b.billNumberFormatted,
          b.customerName,
          formatNumber(b.totalBag),
          formatNumber(b.totalWeight),
          `₹${formatCurrency(b.totalDebit)}`,
          `₹${formatCurrency(b.cashReceived)}`,
          `₹${formatCurrency(b.closingBalance)}`,
        ]);
        totalsData = [
          `TOTAL (${dailyBills.length} Bills)`,
          formatNumber(dailyTotals.totalBags),
          formatNumber(dailyTotals.totalWeight),
          `₹${formatCurrency(dailyTotals.totalDebit)}`,
          `₹${formatCurrency(dailyTotals.totalCashCollected)}`,
          '-',
        ];
      } else if (activeTab === 'sales') {
        title = 'தேதி வாரியான விற்பனை அறிக்கை (Date-wise Sales Summary)';
        subtitle = `Period: ${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        filename = `CPN_Datewise_Sales_${startDate}_to_${endDate}.pdf`;
        columns = [
          { label: '#', width: '5%', align: 'center' },
          { label: 'Date', width: '18%', align: 'left', bold: true },
          { label: 'Bills Count', width: '14%', align: 'center' },
          { label: 'Total Bags', width: '14%', align: 'right' },
          { label: 'Total Weight (kg)', width: '16%', align: 'right' },
          { label: 'Total Debit (₹)', width: '16%', align: 'right', bold: true },
          { label: 'Collection (₹)', width: '17%', align: 'right', color: '#065f46', bold: true },
        ];
        rowData = salesList.map((r, idx) => [
          idx + 1,
          r.date,
          r.billCount,
          formatNumber(r.totalBags),
          formatNumber(r.totalWeight),
          `₹${formatCurrency(r.totalDebit)}`,
          `₹${formatCurrency(r.cashReceived)}`,
        ]);
      } else if (activeTab === 'vegetables') {
        title = 'காய்கறி வாரியான அறிக்கை (Vegetable-wise Movement Report)';
        subtitle = `Period: ${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        filename = `CPN_Vegetable_Movement_${startDate}_to_${endDate}.pdf`;
        columns = [
          { label: '#', width: '6%', align: 'center' },
          { label: 'Vegetable / பொருள்', width: '34%', align: 'left', bold: true },
          { label: 'Total Bags / பை', width: '15%', align: 'right' },
          { label: 'Total Weight (kg) / எடை', width: '17%', align: 'right' },
          { label: 'Avg Rate (₹) / சராசரி விலை', width: '14%', align: 'right' },
          { label: 'Total Revenue (₹) / வருவாய்', width: '14%', align: 'right', color: '#034D28', bold: true },
        ];
        rowData = vegList.map((v, idx) => [
          idx + 1,
          v.vegetable,
          formatNumber(v.totalBags),
          formatNumber(v.totalWeight),
          `₹${formatCurrency(v.avgRate)}`,
          `₹${formatCurrency(v.totalRevenue)}`,
        ]);
      } else if (activeTab === 'monthly') {
        title = 'மாதாந்திர வணிக அறிக்கை (Monthly Performance Summary)';
        subtitle = 'Historical Monthly Performance Summary';
        filename = `CPN_Monthly_Summary_${todayStr}.pdf`;
        columns = [
          { label: '#', width: '8%', align: 'center' },
          { label: 'Month / மாதம்', width: '30%', align: 'left', bold: true },
          { label: 'Bills Count', width: '18%', align: 'center' },
          { label: 'Total Debit (₹)', width: '22%', align: 'right', bold: true },
          { label: 'Total Collection (₹)', width: '22%', align: 'right', color: '#065f46', bold: true },
        ];
        rowData = monthlyList.map((m, idx) => [
          idx + 1,
          m.month,
          m.billCount,
          `₹${formatCurrency(m.totalDebit)}`,
          `₹${formatCurrency(m.totalCollection)}`,
        ]);
      }

      if (rowData.length === 0) {
        alert('No records available to export.');
        return;
      }

      // Chunk rows into discrete pages
      const chunkRows = (rowsList) => {
        if (rowsList.length <= 15) {
          return [rowsList];
        }
        const pages = [];
        pages.push(rowsList.slice(0, 16));
        let start = 16;
        while (start < rowsList.length) {
          const remaining = rowsList.length - start;
          if (remaining <= 16) {
            pages.push(rowsList.slice(start));
            break;
          }
          if (remaining <= 18) {
            const take = Math.ceil(remaining / 2);
            pages.push(rowsList.slice(start, start + take));
            start += take;
          } else {
            pages.push(rowsList.slice(start, start + 18));
            start += 18;
          }
        }
        return pages;
      };

      const pageChunks = chunkRows(rowData);
      const totalPages = pageChunks.length;

      // Verification helper to ensure image contains rendered content (not blank white)
      const verifyNonBlank = async (dataUrl) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              const testCanvas = document.createElement('canvas');
              testCanvas.width = 60;
              testCanvas.height = 40;
              const ctx = testCanvas.getContext('2d');
              ctx.drawImage(img, 0, 0, 60, 40);
              const data = ctx.getImageData(0, 0, 60, 40).data;
              let nonWhitePixels = 0;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 220 || data[i + 1] < 220 || data[i + 2] < 220) {
                  nonWhitePixels++;
                }
              }
              resolve(nonWhitePixels > 10);
            } catch (e) {
              resolve(true);
            }
          };
          img.onerror = () => resolve(false);
          img.src = dataUrl;
        });
      };

      // Dedicated off-screen staging container
      const stage = document.createElement('div');
      stage.style.position = 'fixed';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.width = '1122px';
      stage.style.zIndex = '-9999';
      stage.style.opacity = '1';
      stage.style.pointerEvents = 'none';
      stage.style.background = '#ffffff';
      document.body.appendChild(stage);

      const pdf = new jsPDF('l', 'mm', 'a4');

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage('a4', 'l');
        const isFirstPage = i === 0;
        const isLastPage = i === totalPages - 1;
        const pageRows = pageChunks[i];

        const pageEl = document.createElement('div');
        pageEl.style.width = '1122px';
        pageEl.style.height = '794px';
        pageEl.style.boxSizing = 'border-box';
        pageEl.style.padding = '22px 30px';
        pageEl.style.background = '#ffffff';
        pageEl.style.color = '#111827';
        pageEl.style.position = 'relative';
        pageEl.style.fontFamily = "'Outfit', 'Mukta Malar', 'Noto Sans Tamil', sans-serif";

        let headerHtml = '';
        if (isFirstPage) {
          headerHtml = `
            <div style="border-bottom: 2px solid #034D28; padding-bottom: 6px; margin-bottom: 10px; text-align: center;">
              <div style="color: #034D28; font-size: 13px; font-weight: 700; margin-bottom: 3px;">
                ${settings.tamilHeaderDeity || 'ஸ்ரீ பாப்பாட்டி ஆச்சி ஒச்சாண்டம்மன் துணை'}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="width: 140px; text-align: left; font-size: 11px; color: #4b5563; line-height: 1.3;">
                  <div style="font-weight: 700;">22-A, காந்தி மார்க்கெட்</div>
                  <div>திண்டுக்கல்</div>
                </div>
                <div style="text-align: center;">
                  <div style="color: #034D28; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; line-height: 1;">
                    ${settings.shopName || 'CPN VEGETABLES'}
                  </div>
                  <div style="color: #034D28; font-size: 13px; font-weight: 700; margin-top: 2px;">
                    ${settings.tamilBusinessDescription || 'காய்கறி கமிஷன் மண்டி'} • Prop. CPN ராஜா
                  </div>
                </div>
                <div style="width: 150px; text-align: right; font-size: 11px; color: #4b5563; font-weight: 700; line-height: 1.3;">
                  <div>Ph: 97152 67025</div>
                  <div>97882 29090</div>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #d1d5db; font-size: 12px;">
                <span style="font-weight: 800; color: #034D28;">${title}</span>
                <span style="font-weight: 700; color: #4b5563;">${subtitle}</span>
                <span style="font-weight: 800; color: #034D28;">பக்கம் ${i + 1} / ${totalPages} (Page ${i + 1} of ${totalPages})</span>
              </div>
            </div>
          `;
        } else {
          headerHtml = `
            <div style="border-bottom: 2px solid #034D28; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #034D28; font-size: 16px; font-weight: 900;">${settings.shopName || 'CPN VEGETABLES'}</span>
                <span style="color: #6b7280;">•</span>
                <span style="font-weight: 800; color: #034D28;">${title.split('(')[0]}</span>
              </div>
              <span style="font-weight: 700; color: #4b5563;">${subtitle}</span>
              <span style="font-weight: 800; color: #034D28;">பக்கம் ${i + 1} / ${totalPages} (Page ${i + 1} of ${totalPages})</span>
            </div>
          `;
        }

        const thsHtml = columns
          .map(
            (col) =>
              `<th style="width: ${col.width}; padding: 7px 6px; text-align: ${col.align}; border: 1px solid #02381c; font-weight: 800;">${col.label}</th>`
          )
          .join('');

        let trsHtml = '';
        pageRows.forEach((row, rIdx) => {
          const bg = rIdx % 2 === 0 ? '#ffffff' : '#f8faf8';
          const tdsHtml = row
            .map((cell, cIdx) => {
              const col = columns[cIdx];
              const align = col ? col.align : 'left';
              const isBold = col?.bold ? 'font-weight: 800;' : 'font-weight: 700;';
              const color = col?.color ? `color: ${col.color};` : 'color: #111827;';
              const fontSz = col?.fontSize ? `font-size: ${col.fontSize};` : 'font-size: 13px;';
              const whiteSp = align === 'right' || align === 'center' ? 'white-space: nowrap;' : 'word-break: break-word;';
              return `<td style="padding: 5px 6px; text-align: ${align}; border: 1px solid #d1d5db; ${isBold} ${color} ${fontSz} ${whiteSp}">${cell}</td>`;
            })
            .join('');
          trsHtml += `<tr style="background-color: ${bg};">${tdsHtml}</tr>`;
        });

        let tfootHtml = '';
        if (isLastPage && totalsData) {
          const totalTdsHtml = totalsData
            .map((val, idx) => {
              if (idx === 0) {
                return `<td colspan="2" style="padding: 6px 8px; text-align: left; border: 1px solid #d1d5db; font-size: 13.5px; font-weight: 900; color: #111827;">${val}</td>`;
              }
              const col = columns[idx + 1];
              const align = col ? col.align : 'right';
              const color = col?.color ? `color: ${col.color};` : 'color: #111827;';
              return `<td style="padding: 6px 6px; text-align: ${align}; border: 1px solid #d1d5db; font-weight: 900; font-size: 14px; white-space: nowrap; ${color}">${val}</td>`;
            })
            .join('');
          tfootHtml = `
            <tfoot>
              <tr style="background-color: #f3f4f6; font-weight: 900; border-top: 2px solid #034D28; border-bottom: 2px solid #034D28;">
                ${totalTdsHtml}
              </tr>
            </tfoot>
          `;
        }

        pageEl.innerHTML = `
          ${headerHtml}
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="background-color: #034D28; color: #ffffff; font-size: 12px; text-transform: uppercase;">
                ${thsHtml}
              </tr>
            </thead>
            <tbody>
              ${trsHtml}
            </tbody>
            ${tfootHtml}
          </table>
          <div style="position: absolute; bottom: 14px; left: 30px; right: 30px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 4px;">
            <span style="color: #034D28; font-weight: 700;">${settings.footerText || 'வாழ்க வளமுடன்'}</span>
            <span>${settings.shopName || 'CPN VEGETABLES'} • Wholesale Billing & Management System, Dindigul</span>
            <span style="font-weight: 700;">Page ${i + 1} of ${totalPages}</span>
          </div>
        `;

        stage.appendChild(pageEl);
        await new Promise((r) => setTimeout(r, 60));

        const dataUrl = await toPng(pageEl, {
          width: 1122,
          height: 794,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });

        const isNonBlank = await verifyNonBlank(dataUrl);
        if (!isNonBlank) {
          throw new Error(`Page ${i + 1} image generation produced empty output.`);
        }

        pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        stage.removeChild(pageEl);
      }

      if (stage.parentNode) {
        stage.parentNode.removeChild(stage);
      }

      pdf.save(filename);
    } catch (err) {
      console.error('[Reports] Failed to generate PDF download:', err);
      alert('Failed to generate PDF download: ' + err.message);
    } finally {
      const leftover = document.querySelector('div[style*="z-index: -9999"]');
      if (leftover && leftover.parentNode) {
        leftover.parentNode.removeChild(leftover);
      }
      setIsDownloadingPdf(false);
    }
  };

  // Report metadata for print letterhead
  const getReportMeta = () => {
    switch (activeTab) {
      case 'daily':
        return {
          title: 'Daily Billing Report / தினசரி விற்பனை அறிக்கை',
          period: `Date: ${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        };
      case 'sales':
        return {
          title: 'Date-wise Sales Summary / தேதி வாரியான விற்பனை அறிக்கை',
          period: `Period: ${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        };
      case 'outstanding':
        return {
          title: 'Customer Outstanding Balance Ledger / வாடிக்கையாளர் நிலுவைத் தொகை அறிக்கை',
          period: `As of: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        };
      case 'vegetables':
        return {
          title: 'Vegetable-wise Movement & Volume Report / காய்கறி வாரியான அறிக்கை',
          period: `Period: ${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        };
      case 'monthly':
        return {
          title: 'Monthly Business Performance Summary / மாதாந்திர வணிக அறிக்கை',
          period: 'Historical Performance Summary',
        };
      default:
        return { title: 'Business Report', period: '' };
    }
  };

  const reportMeta = getReportMeta();

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* ========================================================================= */}
      {/* 1. DEDICATED PRINTABLE REPORT LETTERHEAD (Strictly visible in print)     */}
      {/* ========================================================================= */}
      <div className="report-print-header">
        <div className="text-center pb-2 border-b-2 border-[#034D28]">
          <p className="text-xs font-tamil text-[#034D28] font-bold tracking-wide">
            ஸ்ரீ பாப்பாட்டி ஆச்சி ஒச்சாண்டம்மன் துணை
          </p>
          <div className="flex items-center justify-between mt-1 px-2">
            <div className="w-14 h-14 flex items-center justify-center">
              <img
                src="/cpn_logo.png"
                alt="CPN"
                className="w-14 h-14 object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className="text-center flex-1 px-4">
              <h1 className="text-2xl font-black text-[#034D28] tracking-tight leading-tight">
                CPN VEGETABLES
              </h1>
              <p className="text-xs font-bold font-tamil text-gray-800 mt-0.5">
                இங்கிலீஷ் காய்கறி கமிஷன் மண்டி
              </p>
              <p className="text-[11px] text-gray-600 font-tamil">
                22-A, காந்தி மார்க்கெட், திண்டுக்கல்
              </p>
            </div>
            <div className="text-right text-[11px] font-bold text-gray-700 leading-tight">
              <p>Ph: 97152 67025</p>
              <p>Ph: 97882 29090</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
            <span className="font-extrabold text-xs text-[#034D28]">{reportMeta.title}</span>
            <span className="font-semibold text-gray-700">{reportMeta.period}</span>
            <span className="text-[10px] text-gray-500 font-mono-num">
              Printed: {new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ON-SCREEN HEADER & ACTION BAR (Hidden in print)                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Business Reports & Analytics / அறிக்கைகள்
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Daily sales, outstanding collections, vegetable movement, and monthly metrics
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-[#034D28] text-white hover:bg-emerald-900 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-98 disabled:opacity-60"
            title="Download printable report as PDF"
          >
            <Download className="w-4 h-4 text-white" />
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-3.5 py-2 border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-98"
            title="Download report data as CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            className="px-4 py-2 border border-[#034D28] bg-white text-[#034D28] hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-98"
          >
            <Printer className="w-4 h-4 text-[#034D28]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Hidden in print) */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-200 flex overflow-x-auto no-scrollbar gap-2 pb-2 sm:flex-wrap no-print">
        {[
          { id: 'daily', label: '1. Daily Billing Report', icon: Calendar },
          { id: 'sales', label: '2. Date-wise Sales', icon: TrendingUp },
          { id: 'outstanding', label: '3. Customer Outstanding', icon: Users },
          { id: 'vegetables', label: '4. Vegetable-wise Movement', icon: Carrot },
          { id: 'monthly', label: '5. Monthly Summary', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 min-h-[38px] ${
                isActive
                  ? 'bg-[#034D28] text-white shadow-md border border-[#034D28] font-black'
                  : 'bg-emerald-50/80 text-[#034D28] border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 font-bold shadow-2xs'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#034D28]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar (Hidden in print) */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3 no-print">
        {activeTab === 'daily' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-mono-num font-bold focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-[#034D28] bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 cursor-pointer"
            >
              Today
            </button>
          </div>
        ) : activeTab === 'outstanding' ? (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="text-xs text-gray-700 font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#034D28]" />
              <span>Showing all active customer outstanding debit ledger balances</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold focus:border-[#034D28] outline-none min-h-[38px] w-48 sm:w-64"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="text-xs text-gray-500 hover:text-gray-800 font-bold px-2 py-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : activeTab === 'monthly' ? (
          <div className="text-xs text-gray-700 font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#034D28]" />
            <span>Showing monthly billing & cash collection performance summary</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-mono-num font-bold focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
            />
            <span className="text-gray-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-mono-num font-bold focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. REPORT CONTENT CARD                                                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 overflow-hidden report-card">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-semibold animate-pulse">
            Loading report data...
          </div>
        ) : activeTab === 'daily' ? (
          /* TAB 1: DAILY BILLING REPORT */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3 no-print">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  Daily Billing Report -{' '}
                  {dailyData?.reportDate
                    ? new Date(dailyData.reportDate).toLocaleDateString('en-IN', { dateStyle: 'long' })
                    : selectedDate}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {dailySummary.totalBills} Bills generated today
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    'Daily_Report',
                    dailyBills.map((b) => ({
                      BillNo: b.billNumberFormatted,
                      Customer: b.customerName,
                      Bags: b.totalBag,
                      Weight: b.totalWeight,
                      Debit: b.totalDebit,
                      Credit: b.totalCredit,
                      CashReceived: b.cashReceived,
                      ClosingBalance: b.closingBalance,
                    }))
                  )
                }
                className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Daily Metrics Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 report-summary-grid">
              <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl report-summary-card">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase block">Total Debit / Sales</span>
                <span className="text-base sm:text-xl font-black font-mono-num text-[#034D28]">
                  ₹{formatCurrency(dailySummary.totalDebit)}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl report-summary-card">
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase block">Total Bags</span>
                <span className="text-base sm:text-xl font-black font-mono-num text-gray-900">{dailySummary.totalBags}</span>
              </div>
              <div className="p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl report-summary-card">
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase block">Total Weight (Kg)</span>
                <span className="text-base sm:text-xl font-black font-mono-num text-gray-900">
                  {formatNumber(dailySummary.totalWeight)}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 bg-amber-50/80 border border-amber-200 rounded-xl report-summary-card">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase block">Total Cash Collected</span>
                <span className="text-base sm:text-xl font-black font-mono-num text-amber-900">
                  ₹{formatCurrency(dailySummary.totalCashCollected)}
                </span>
              </div>
            </div>

            {/* Bills Table */}
            {dailyBills.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No bills recorded on this date.
              </div>
            ) : (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-left">Bill No</th>
                      <th className="py-2.5 px-3 text-left">Customer</th>
                      <th className="py-2.5 px-3 text-center">Bags</th>
                      <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Today Total (₹)</th>
                      <th className="py-2.5 px-3 text-right">Discount (₹)</th>
                      <th className="py-2.5 px-3 text-right">Varavu (₹)</th>
                      <th className="py-2.5 px-3 text-right">Closing (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyBills.map((b) => (
                      <tr key={b._id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono-num font-bold text-[#034D28]">{b.billNumberFormatted}</td>
                        <td className="py-2 px-3 font-bold text-gray-900">{b.customerName}</td>
                        <td className="py-2 px-3 text-center font-mono-num">{b.totalBag}</td>
                        <td className="py-2 px-3 text-right font-mono-num">{formatNumber(b.totalWeight)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-gray-900">
                          ₹{formatCurrency(b.todayTotal !== undefined && b.todayTotal !== null ? b.todayTotal : b.totalDebit)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-amber-800">
                          {b.discount > 0 ? `₹${formatCurrency(b.discount)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-emerald-800">
                          {(b.varavu !== undefined ? b.varavu : b.cashReceived) > 0
                            ? `₹${formatCurrency(b.varavu !== undefined ? b.varavu : b.cashReceived)}`
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-[#034D28]">
                          ₹{formatCurrency(b.closingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td colSpan="2" className="py-2.5 px-3 text-left">TOTAL ({dailyBills.length} Bills)</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">{dailySummary.totalBags}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{formatNumber(dailySummary.totalWeight)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#034D28]">₹{formatCurrency(dailySummary.totalDebit)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-amber-800">
                        ₹{formatCurrency(dailyBills.reduce((acc, b) => acc + (b.discount || 0), 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-800">
                        ₹{formatCurrency(dailySummary.totalCashCollected)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#034D28]">
                        ₹{formatCurrency(dailyBills.reduce((acc, b) => acc + (b.closingBalance || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'sales' ? (
          /* TAB 2: DATE-WISE SALES */
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <div>
                <h3 className="text-lg font-black text-gray-900">Date-wise Sales Summary</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Aggregated daily bills, weight, sales revenue, and collections
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    'Datewise_Sales',
                    salesList.map((r) => ({
                      Date: r.date,
                      BillsCount: r.billCount,
                      Bags: r.totalBags,
                      WeightKg: r.totalWeight,
                      TotalDebit: r.totalDebit,
                      CashReceived: r.cashReceived,
                    }))
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {salesList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No sales data recorded for the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-left">Date</th>
                      <th className="py-2.5 px-3 text-center">Bills Count</th>
                      <th className="py-2.5 px-3 text-center">Bags</th>
                      <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Total Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Cash Received (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesList.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono-num font-bold text-gray-900">
                          {new Date(row.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center font-mono-num font-bold">{row.billCount}</td>
                        <td className="py-2 px-3 text-center font-mono-num">{row.totalBags}</td>
                        <td className="py-2 px-3 text-right font-mono-num">{formatNumber(row.totalWeight)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-extrabold text-[#034D28]">
                          ₹{formatCurrency(row.totalDebit)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-emerald-800">
                          ₹{formatCurrency(row.cashReceived)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td className="py-2.5 px-3 text-left">TOTAL ({salesList.length} Days)</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">
                        {salesList.reduce((acc, r) => acc + (r.billCount || 0), 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-num">
                        {salesList.reduce((acc, r) => acc + (r.totalBags || 0), 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {formatNumber(salesList.reduce((acc, r) => acc + (r.totalWeight || 0), 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#034D28]">
                        ₹{formatCurrency(salesList.reduce((acc, r) => acc + (r.totalDebit || 0), 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-800">
                        ₹{formatCurrency(salesList.reduce((acc, r) => acc + (r.cashReceived || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'outstanding' ? (
          /* TAB 3: CUSTOMER OUTSTANDING */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3 no-print">
              <div>
                <h3 className="text-lg font-black text-gray-900">Customer Outstanding Balance Ledger</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Total Outstanding Balance across {filteredOutstanding.length} customers:{' '}
                  <strong className="text-amber-800">
                    ₹{formatCurrency(sumNewBalance)}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#034D28] hover:bg-emerald-900 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                  title="Download Customer Outstanding PDF"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer border border-emerald-200"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {filteredOutstanding.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                {customerSearch ? `No customer found matching "${customerSearch}"` : 'No customers with outstanding balances found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse report-outstanding-table min-w-[720px]">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 text-left w-[34%] min-w-[180px]">Customer Name</th>
                      <th className="py-2.5 px-3 text-right">Old Balance (₹)</th>
                      <th className="py-2.5 px-3 text-right">Latest Bill Total (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total Outstanding (₹)</th>
                      <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                      <th className="py-2.5 px-3 text-right w-[26%] min-w-[150px]">New Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOutstanding.map((c, idx) => (
                      <tr key={c._id || idx} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-center font-mono-num font-bold text-gray-600 report-col-idx text-sm md:text-base">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 report-customer-name font-black text-gray-950 text-lg md:text-xl tracking-tight">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-gray-700 text-base md:text-lg whitespace-nowrap">
                          ₹{formatCurrency(c.oldBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-gray-900 text-base md:text-lg whitespace-nowrap">
                          ₹{formatCurrency(c.latestBillTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-[#034D28] text-base md:text-lg whitespace-nowrap">
                          ₹{formatCurrency(c.totalOutstanding)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-emerald-800 text-base md:text-lg whitespace-nowrap">
                          ₹{formatCurrency(c.paid)}
                        </td>
                        <td className="py-2.5 px-3 text-right report-outstanding-amount font-mono-num font-black text-amber-900 text-lg md:text-xl whitespace-nowrap">
                          ₹{formatCurrency(c.newBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td colSpan="2" className="py-3 px-3 text-left font-black text-base md:text-lg">
                        TOTAL ({filteredOutstanding.length} Customers)
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-black text-gray-800 text-base md:text-lg whitespace-nowrap">
                        ₹{formatCurrency(sumOldBalance)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-black text-gray-900 text-base md:text-lg whitespace-nowrap">
                        ₹{formatCurrency(sumLatestBillTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-black text-[#034D28] text-base md:text-lg whitespace-nowrap">
                        ₹{formatCurrency(sumTotalOutstanding)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-black text-emerald-800 text-base md:text-lg whitespace-nowrap">
                        ₹{formatCurrency(sumPaid)}
                      </td>
                      <td className="py-3 px-3 text-right report-outstanding-total font-mono-num font-black text-amber-900 text-xl md:text-2xl whitespace-nowrap">
                        ₹{formatCurrency(sumNewBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'vegetables' ? (
          /* TAB 4: VEGETABLE MOVEMENT & REVENUE */
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <div>
                <h3 className="text-lg font-black text-gray-900">Vegetable-wise Billing & Volume Report</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Summary of bags, kilograms, average rate, and revenue by vegetable
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    'Vegetable_Movement',
                    vegList.map((v) => ({
                      Vegetable: v.vegetable,
                      BagsSold: v.totalBags,
                      WeightKg: v.totalWeight,
                      AvgRatePerKg: v.avgRate,
                      TotalRevenue: v.totalRevenue,
                    }))
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {vegList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No vegetable movement recorded for the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 text-left">Vegetable Name</th>
                      <th className="py-2.5 px-3 text-center">Bags Sold</th>
                      <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Avg Rate / Kg (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vegList.map((veg, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-center font-mono-num text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-extrabold text-gray-900">{veg.vegetable}</td>
                        <td className="py-2 px-3 text-center font-mono-num font-bold">{veg.totalBags}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-semibold">
                          {formatNumber(veg.totalWeight)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-semibold">
                          ₹{formatNumber(veg.avgRate)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-black text-[#034D28]">
                          ₹{formatCurrency(veg.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td colSpan="2" className="py-2.5 px-3 text-left">TOTAL ({vegList.length} Items)</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">
                        {vegList.reduce((acc, v) => acc + (v.totalBags || 0), 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {formatNumber(vegList.reduce((acc, v) => acc + (v.totalWeight || 0), 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-gray-500">-</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#034D28]">
                        ₹{formatCurrency(vegList.reduce((acc, v) => acc + (v.totalRevenue || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* TAB 5: MONTHLY SUMMARY */
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <div>
                <h3 className="text-lg font-black text-gray-900">Monthly Business Performance Summary</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Month-by-month sales, bills count, and total cash collections
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    'Monthly_Performance',
                    monthlyList.map((m) => ({
                      Month: m.month,
                      BillsCount: m.billCount,
                      TotalDebit: m.totalDebit,
                      TotalCollection: m.totalCollection,
                    }))
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {monthlyList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No monthly performance data recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-left">Month</th>
                      <th className="py-2.5 px-3 text-center">Bills Count</th>
                      <th className="py-2.5 px-3 text-right">Total Debit / Sales (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total Cash Collected (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthlyList.map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-gray-900">{m.month}</td>
                        <td className="py-2.5 px-3 text-center font-mono-num font-bold">{m.billCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-black text-[#034D28]">
                          ₹{formatCurrency(m.totalDebit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-extrabold text-emerald-800">
                          ₹{formatCurrency(m.totalCollection)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td className="py-2.5 px-3 text-left">TOTAL ({monthlyList.length} Months)</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">
                        {monthlyList.reduce((acc, m) => acc + (m.billCount || 0), 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#034D28]">
                        ₹{formatCurrency(monthlyList.reduce((acc, m) => acc + (m.totalDebit || 0), 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-800">
                        ₹{formatCurrency(monthlyList.reduce((acc, m) => acc + (m.totalCollection || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
