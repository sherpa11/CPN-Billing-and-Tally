import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Carrot,
  Wallet,
  TrendingUp,
  CreditCard,
  PlusCircle,
  Clock,
  Printer,
  ArrowUpRight,
  Sparkles,
  Truck,
  Package,
  Scale,
  FileText,
} from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, formatNumber } from '../utils/math';
import PrintModal from '../components/PrintModal';

export const Dashboard = () => {
  const { settings } = useSettings();
  const [stats, setStats] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Individual Bill Print Modal state
  const [activePrintBill, setActivePrintBill] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printLoadingId, setPrintLoadingId] = useState(null);

  // Safe read-only print retrieval by unique bill ID
  const handlePrintBill = async (billId) => {
    if (!billId || printLoadingId) return;
    try {
      setPrintLoadingId(billId);
      const res = await api.get(`/bills/${billId}`);
      if (res.success && res.data) {
        setActivePrintBill(res.data);
        setShowPrintModal(true);
      } else {
        alert('Unable to load bill data');
      }
    } catch (err) {
      console.error('Failed to load bill for printing:', err);
      alert('Failed to load bill for printing');
    } finally {
      setPrintLoadingId(null);
    }
  };

  // Safe read-only print retrieval by unique purchase ID
  const handlePrintPurchase = async (purchaseId) => {
    if (!purchaseId || printLoadingId) return;
    try {
      setPrintLoadingId(purchaseId);
      const res = await api.get(`/purchases/${purchaseId}`);
      if (res.success && res.data) {
        setActivePrintBill({ ...res.data, isPurchase: true, billType: 'purchase' });
        setShowPrintModal(true);
      } else {
        alert('Unable to load purchase bill data');
      }
    } catch (err) {
      console.error('Failed to load purchase bill for printing:', err);
      alert('Failed to load purchase bill for printing');
    } finally {
      setPrintLoadingId(null);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [statsRes, billsRes, purchasesRes] = await Promise.all([
          api.get('/reports/dashboard-stats'),
          api.get('/bills?limit=6'),
          api.get('/purchases?limit=6'),
        ]);

        if (statsRes.success) setStats(statsRes);
        if (billsRes.success) setRecentBills(billsRes.data);
        if (purchasesRes.success) setRecentPurchases(purchasesRes.data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#034D28] via-[#023f21] to-[#023119] text-white p-5 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white p-1 flex-shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={settings.logoUrl || '/cpn_logo.png'}
              alt="CPN Logo"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-700/80 text-emerald-200 font-bold px-2.5 py-0.5 rounded-full font-tamil">
                {settings.tamilHeaderDeity || 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை'}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1">
              {settings.shopName || 'CPN VEGETABLES'}
            </h1>
            <p className="text-xs text-emerald-200 font-tamil font-medium">
              {settings.tamilBusinessDescription || 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி'} • {settings.address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <NavLink
            to="/new-bill"
            className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-[#034D28] font-black rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>Create Bill (F2)</span>
          </NavLink>
        </div>
      </div>

      {/* Metric Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Today's Bills */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Bills</span>
              <Receipt className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono-num text-gray-900">
                {stats.todayBillsCount}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>
          </div>

          {/* Card 2: Today's Sales */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Sales</span>
              <TrendingUp className="w-4 h-4 text-[#034D28] flex-shrink-0" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono-num text-[#034D28]">
                ₹{formatCurrency(stats.todaySales !== undefined ? stats.todaySales : stats.todayDebit)}
              </span>
            </div>
          </div>

          {/* Card 3: Today's Payments Received */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Payments Received Today</span>
              <Wallet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            </div>
            <div className="flex items-baseline justify-between flex-wrap gap-1">
              <span className="text-2xl font-black font-mono-num text-emerald-800">
                ₹{formatCurrency(stats.todayPaymentsReceived !== undefined ? stats.todayPaymentsReceived : stats.todayCash)}
              </span>
              {stats.todayDiscounts > 0 && (
                <span className="text-[11px] font-bold text-amber-700 font-mono-num">
                  -₹{formatCurrency(stats.todayDiscounts)} disc.
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Total Customer Outstanding */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Outstanding</span>
              <Users className="w-4 h-4 text-amber-700 flex-shrink-0" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono-num text-amber-800">
                ₹{formatCurrency(stats.totalOutstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Stats Row - Responsive Single Column on Mobile to Prevent Overflow */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#034D28] flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block leading-tight">Active Customers</span>
                <span className="text-xl font-black font-mono-num text-gray-900">{stats.activeCustomers}</span>
              </div>
            </div>
            <NavLink
              to="/customers"
              className="text-xs font-bold text-[#034D28] hover:bg-emerald-100 flex items-center gap-1 flex-shrink-0 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#034D28] flex items-center justify-center flex-shrink-0">
                <Carrot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block leading-tight">Master Vegetables</span>
                <span className="text-xl font-black font-mono-num text-gray-900">{stats.activeVegetables}</span>
              </div>
            </div>
            <NavLink
              to="/vegetables"
              className="text-xs font-bold text-[#034D28] hover:bg-emerald-100 flex items-center gap-1 flex-shrink-0 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Dedicated Purchase Summary Section / கொள்முதல் சுருக்கம் */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-1">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#034D28] text-white flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 tracking-tight">
                  Purchase Summary / கொள்முதல் சுருக்கம்
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-[#034D28] border border-emerald-200 rounded-full">
                  Supplier Procurement
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Today's supplier purchases and recent purchase transactions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/new-bill?type=purchase"
              className="px-3.5 py-1.5 bg-[#034D28] hover:bg-[#023c1f] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Purchase (PUR)</span>
            </NavLink>
            <NavLink
              to="/bills?tab=purchase"
              className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-[#034D28] border border-emerald-200 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
        </div>

        {/* 4 Dedicated Purchase Metric Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Today's Total Purchases */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Today's Purchases</span>
                <Truck className="w-4 h-4 text-[#034D28] flex-shrink-0" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono-num text-[#034D28]">
                  ₹{formatCurrency(stats.todayPurchasesTotal || 0)}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold font-mono-num">
                  Procurement
                </span>
              </div>
            </div>

            {/* 2. Total Purchase Bills Generated Today */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Purchase Bills Today</span>
                <Receipt className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono-num text-gray-900">
                  {stats.todayPurchasesCount || 0}
                </span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  PUR Bills
                </span>
              </div>
            </div>

            {/* 3. Total Bags Purchased */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Bags Purchased</span>
                <Package className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono-num text-gray-900">
                  {stats.todayPurchasesBags || 0}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold font-mono-num">
                  Bags
                </span>
              </div>
            </div>

            {/* 4. Total Weight Purchased (KG) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Weight (KG)</span>
                <Scale className="w-4 h-4 text-amber-700 flex-shrink-0" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono-num text-gray-900">
                  {formatNumber(stats.todayPurchasesWeight || 0)} <span className="text-sm font-bold text-gray-500">kg</span>
                </span>
                <span className="text-[11px] text-gray-400 font-semibold font-mono-num">
                  Weight
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Purchase Bills Table / Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#034D28]" />
              <h3 className="font-bold text-base text-gray-900">Recent Purchase Bills / சமீபத்திய கொள்முதல் பில்கள்</h3>
            </div>
            <NavLink
              to="/bills?tab=purchase"
              className="text-xs font-bold text-[#034D28] hover:underline flex items-center gap-1"
            >
              <span>View All Purchases</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 font-semibold">Loading recent purchase bills...</div>
          ) : recentPurchases.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Truck className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="font-bold text-sm text-gray-600">No purchase bills recorded yet</p>
              <NavLink
                to="/new-bill?type=purchase"
                className="text-xs font-bold text-[#034D28] hover:underline mt-1 inline-block"
              >
                + Record your first supplier purchase bill
              </NavLink>
            </div>
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="md:hidden space-y-2.5">
                {recentPurchases.map((p) => (
                  <div
                    key={p._id}
                    className="p-3 bg-gray-50/80 border border-gray-200 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-black text-[#034D28] text-sm">
                          {p.purchaseNumberFormatted || `PUR-${p.purchaseNumber}`}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            p.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-[#034D28]'
                          }`}
                        >
                          {p.status === 'cancelled' ? 'Cancelled' : 'Active'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 font-mono-num font-medium">
                          {new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePrintPurchase(p._id)}
                          disabled={printLoadingId === p._id}
                          className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-200 rounded-lg min-h-[34px] min-w-[34px] cursor-pointer"
                          title={`Print Purchase #${p.purchaseNumberFormatted}`}
                        >
                          {printLoadingId === p._id ? (
                            <span className="w-3.5 h-3.5 border-2 border-[#034D28] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Printer className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="font-bold text-gray-900 text-sm">
                      {p.supplierName}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-gray-200/80 text-xs">
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Bags / Kg</span>
                        <span className="font-mono-num font-semibold text-gray-800">
                          {p.totalBag || 0} / {formatNumber(p.totalWeight || 0)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Total</span>
                        <span className="font-mono-num font-black text-gray-950">
                          ₹{formatCurrency(p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : p.totalDebit)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Paid</span>
                        <span className="font-mono-num font-bold text-emerald-800">
                          ₹{formatCurrency(p.varavu !== undefined ? p.varavu : (p.cashPaid || 0))}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Balance</span>
                        <span className="font-mono-num font-black text-[#034D28]">
                          ₹{formatCurrency(p.closingBalance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-700 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-left">Purchase Bill No</th>
                      <th className="py-2.5 px-3 text-left">Supplier</th>
                      <th className="py-2.5 px-3 text-left">Date</th>
                      <th className="py-2.5 px-3 text-center">Bags</th>
                      <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Today Total (₹)</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid (₹)</th>
                      <th className="py-2.5 px-3 text-right">Closing Bal (₹)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center w-14">Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentPurchases.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/70">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[#034D28]">
                          {p.purchaseNumberFormatted || `PUR-${p.purchaseNumber}`}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {p.supplierName}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-xs text-gray-600">
                          {new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-num font-bold">
                          {p.totalBag || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num">
                          {formatNumber(p.totalWeight || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-black text-gray-950">
                          ₹{formatCurrency(p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : p.totalDebit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-emerald-800">
                          ₹{formatCurrency(p.varavu !== undefined ? p.varavu : (p.cashPaid || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-extrabold text-[#034D28]">
                          ₹{formatCurrency(p.closingBalance || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              p.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-[#034D28]'
                            }`}
                          >
                            {p.status === 'cancelled' ? 'Cancelled' : 'Active'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintPurchase(p._id)}
                            disabled={printLoadingId === p._id}
                            className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-200 hover:border-emerald-300 rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                            title={`Print Purchase #${p.purchaseNumberFormatted}`}
                          >
                            {printLoadingId === p._id ? (
                              <span className="w-3.5 h-3.5 border-2 border-[#034D28] border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Bills Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#034D28]" />
            <h2 className="font-bold text-base text-gray-900">Recent Vegetable Bills</h2>
          </div>
          <NavLink
            to="/bills"
            className="text-xs font-bold text-[#034D28] hover:underline flex items-center gap-1"
          >
            <span>View All Bills</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 font-semibold">Loading recent bills...</div>
        ) : recentBills.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Receipt className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-bold text-sm text-gray-600">No bills recorded yet</p>
            <NavLink
              to="/new-bill"
              className="text-xs font-bold text-[#034D28] hover:underline mt-1 inline-block"
            >
              + Create your first wholesale bill
            </NavLink>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-2.5">
              {recentBills.map((b) => (
                <div
                  key={b._id}
                  className="p-3 bg-gray-50/80 border border-gray-200 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num font-black text-[#034D28] text-sm">
                      {b.billNumberFormatted}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 font-mono-num font-medium">
                        {new Date(b.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePrintBill(b._id)}
                        disabled={printLoadingId === b._id}
                        className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-200 rounded-lg min-h-[34px] min-w-[34px] cursor-pointer"
                        title={`Print Bill #${b.billNumberFormatted}`}
                      >
                        {printLoadingId === b._id ? (
                          <span className="w-3.5 h-3.5 border-2 border-[#034D28] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="font-bold text-gray-900 text-sm">
                    {b.customerName}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200/80 text-xs">
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">Bags / Kg</span>
                      <span className="font-mono-num font-semibold text-gray-800">
                        {b.totalBag} / {formatNumber(b.totalWeight)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">Debit</span>
                      <span className="font-mono-num font-black text-gray-950">
                        ₹{formatCurrency(b.todayTotal !== undefined && b.todayTotal !== null ? b.todayTotal : b.totalDebit)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">Closing</span>
                      <span className="font-mono-num font-black text-[#034D28]">
                        ₹{formatCurrency(b.closingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-700 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-left">Bill No</th>
                    <th className="py-2.5 px-3 text-left">Customer</th>
                    <th className="py-2.5 px-3 text-center">Bags</th>
                    <th className="py-2.5 px-3 text-right">Weight (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Closing Bal (₹)</th>
                    <th className="py-2.5 px-3 text-center w-14">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBills.map((b) => (
                    <tr key={b._id} className="hover:bg-gray-50/70">
                      <td className="py-2.5 px-3 font-mono-num font-bold text-[#034D28]">
                        {b.billNumberFormatted}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        {b.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-num">
                        {b.totalBag}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {formatNumber(b.totalWeight)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-black text-gray-950">
                        ₹{formatCurrency(b.todayTotal !== undefined && b.todayTotal !== null ? b.todayTotal : b.totalDebit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-extrabold text-[#034D28]">
                        ₹{formatCurrency(b.closingBalance)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handlePrintBill(b._id)}
                          disabled={printLoadingId === b._id}
                          className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-200 hover:border-emerald-300 rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                          title={`Print Bill #${b.billNumberFormatted}`}
                        >
                          {printLoadingId === b._id ? (
                            <span className="w-3.5 h-3.5 border-2 border-[#034D28] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Printer className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Bill Print Preview Modal */}
      <PrintModal
        isOpen={showPrintModal && Boolean(activePrintBill)}
        bill={activePrintBill}
        settings={settings}
        onClose={() => {
          setShowPrintModal(false);
          setActivePrintBill(null);
        }}
      />
    </div>
  );
};

export default Dashboard;
