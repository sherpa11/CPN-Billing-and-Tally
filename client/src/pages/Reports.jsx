import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  Users,
  Carrot,
  TrendingUp,
} from 'lucide-react';
import api from '../api/axios';
import { formatCurrency, formatNumber } from '../utils/math';

export const Reports = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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
    document.body.classList.add('print-report-active');
    const cleanup = () => {
      document.body.classList.remove('print-report-active');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  // Keyboard shortcut Ctrl+P / window print lifecycle hook
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('print-report-active');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-report-active');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-report-active');
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

        <button
          type="button"
          onClick={handlePrintReport}
          className="px-4 py-2 border border-[#034D28] bg-white text-[#034D28] hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-98"
        >
          <Printer className="w-4 h-4 text-[#034D28]" />
          <span>Print Report</span>
        </button>
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
          <div className="text-xs text-gray-700 font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#034D28]" />
            <span>Showing all active customer outstanding debit ledger balances</span>
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
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <div>
                <h3 className="text-lg font-black text-gray-900">Customer Outstanding Balance Ledger</h3>
                <p className="text-xs text-gray-500 font-medium">
                  Total Outstanding Balance across {outstandingData?.totalCustomers || outstandingCustomers.length} customers:{' '}
                  <strong className="text-amber-800">
                    ₹{formatCurrency(outstandingData?.totalOutstanding || 0)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    'Customer_Outstanding',
                    outstandingCustomers.map((c) => ({
                      CustomerName: c.name,
                      TamilName: c.tamilName,
                      Phone: c.phone,
                      OutstandingBalance: c.currentBalance,
                    }))
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {outstandingCustomers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No customers with outstanding balances found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 text-left">Customer Name</th>
                      <th className="py-2.5 px-3 text-left">Tamil Name</th>
                      <th className="py-2.5 px-3 text-left">Mobile</th>
                      <th className="py-2.5 px-3 text-right">Outstanding Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outstandingCustomers.map((c, idx) => (
                      <tr key={c._id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-center font-mono-num text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-gray-900">{c.name}</td>
                        <td className="py-2 px-3 font-tamil text-emerald-800">{c.tamilName || '-'}</td>
                        <td className="py-2 px-3 font-mono-num text-gray-600">{c.phone || '-'}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-black text-amber-800 text-base">
                          ₹{formatCurrency(c.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-400">
                      <td colSpan="4" className="py-2.5 px-3 text-left">
                        TOTAL ({outstandingCustomers.length} Customers)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-black text-amber-800 text-base">
                        ₹{formatCurrency(outstandingData?.totalOutstanding || outstandingCustomers.reduce((acc, c) => acc + (c.currentBalance || 0), 0))}
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
