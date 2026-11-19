import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  XCircle,
  Eye,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Edit2,
  Users,
  Truck,
  PlusCircle,
} from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import { useDebounce } from '../hooks/useDebounce';
import { formatCurrency, formatNumber } from '../utils/math';
import PrintModal from '../components/PrintModal';

export const AllBills = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState(initialTab); // 'all' | 'customer' | 'purchase'
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBills, setTotalBills] = useState(0);

  // Selected bill for viewing / printing
  const [activeBill, setActiveBill] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Cancel modal
  const [cancellingBill, setCancellingBill] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync tab from URL if it changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['all', 'customer', 'purchase'].includes(tabParam)) {
      setActiveTab(tabParam);
      setPage(1);
    }
  }, [searchParams]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page,
        limit: 25,
        status,
        type: activeTab, // 'all' | 'customer' | 'purchase'
      });
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/bills?${params.toString()}`);
      if (res.success) {
        setBills(res.data);
        setTotalPages(res.pages || 1);
        setTotalBills(res.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [page, status, startDate, endDate, debouncedSearch, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const handlePrintBill = async (bill) => {
    try {
      const isPur = bill.billType === 'purchase' || bill.isPurchase || Boolean(bill.purchaseNumber);
      const endpoint = isPur ? `/purchases/${bill._id}` : `/bills/${bill._id}`;
      const res = await api.get(endpoint);
      if (res.success && res.data) {
        setActiveBill(isPur ? { ...res.data, isPurchase: true, billType: 'purchase' } : res.data);
      } else {
        setActiveBill(isPur ? { ...bill, isPurchase: true, billType: 'purchase' } : bill);
      }
      setShowPrintModal(true);
    } catch (e) {
      const isPur = bill.billType === 'purchase' || bill.isPurchase || Boolean(bill.purchaseNumber);
      setActiveBill(isPur ? { ...bill, isPurchase: true, billType: 'purchase' } : bill);
      setShowPrintModal(true);
    }
  };

  const handleEditBill = (bill) => {
    const isPur = bill.billType === 'purchase' || bill.isPurchase || Boolean(bill.purchaseNumber);
    if (isPur) {
      navigate(`/new-bill?edit=${bill._id}&type=purchase`);
    } else {
      navigate(`/new-bill?edit=${bill._id}`);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBill) return;
    try {
      setActionLoading(true);
      const isPur = cancellingBill.billType === 'purchase' || cancellingBill.isPurchase || Boolean(cancellingBill.purchaseNumber);
      const endpoint = isPur ? `/purchases/${cancellingBill._id}/cancel` : `/bills/${cancellingBill._id}/cancel`;
      const res = await api.post(endpoint, {
        reason: cancelReason || `Cancelled from ${isPur ? 'Purchase' : 'Bill'} Management`,
      });
      if (res.success) {
        setCancellingBill(null);
        setCancelReason('');
        fetchBills();
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel bill');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const searchPlaceholder =
    activeTab === 'purchase'
      ? 'Search Supplier or Purchase #...'
      : activeTab === 'customer'
      ? 'Search Customer or Bill #...'
      : 'Search Customer, Supplier or Bill #...';

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              All Bills & History / பில் விவரங்கள்
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              View, reprint, search, and manage customer and supplier bills ({totalBills} records found)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/new-bill')}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#034D28] hover:bg-[#023c1f] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Sale (CPN)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/new-bill?type=purchase')}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-200 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>New Purchase (PUR)</span>
          </button>
        </div>
      </div>

      {/* Tabs Selection: All Bills | Customer Bills | Purchase Bills */}
      <div className="flex border-b border-gray-200 bg-white px-2 pt-2 rounded-t-2xl shadow-xs overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'all'
              ? 'border-[#034D28] text-[#034D28] bg-emerald-50/50 rounded-t-xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>All Bills / அனைத்து பில்கள்</span>
          {activeTab === 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#034D28] font-mono-num font-bold">
              {totalBills}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('customer');
            setPage(1);
          }}
          className={`px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'customer'
              ? 'border-[#034D28] text-[#034D28] bg-emerald-50/50 rounded-t-xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Bills / வாடிக்கையாளர்</span>
          {activeTab === 'customer' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#034D28] font-mono-num font-bold">
              {totalBills}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('purchase');
            setPage(1);
          }}
          className={`px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'purchase'
              ? 'border-[#034D28] text-[#034D28] bg-emerald-50/50 rounded-t-xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Purchase Bills / கொள்முதல்</span>
          {activeTab === 'purchase' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#034D28] font-mono-num font-bold">
              {totalBills}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Search by Name or Bill Number */}
          <div className="md:col-span-4 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-h-[42px] pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:border-[#034D28] outline-none"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          </div>

          {/* Start Date */}
          <div className="md:col-span-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num font-bold focus:border-[#034D28] outline-none"
            />
          </div>

          {/* End Date */}
          <div className="md:col-span-3">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num font-bold focus:border-[#034D28] outline-none"
            />
          </div>

          {/* Status Filter & Search Button */}
          <div className="md:col-span-2 flex gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-h-[42px] px-2.5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
            >
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
            <button
              type="submit"
              className="min-h-[42px] px-4 py-2 bg-[#034D28] text-white rounded-xl font-bold text-xs hover:bg-[#02361c] transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Bills Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-semibold">
            Loading bills from database...
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="font-bold text-base text-gray-700">
              {activeTab === 'purchase'
                ? 'No purchase bills found'
                : activeTab === 'customer'
                ? 'No customer bills found'
                : 'No bills found'}
            </p>
            <p className="text-xs text-gray-500">
              {activeTab === 'purchase'
                ? 'Record a purchase bill using the New Purchase tab'
                : 'Create a new wholesale bill from the New Bill tab'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden divide-y divide-gray-100">
              {bills.map((bill) => {
                const isPur = bill.billType === 'purchase' || bill.isPurchase || Boolean(bill.purchaseNumber);
                const billNum = bill.purchaseNumberFormatted || bill.billNumberFormatted || `#${bill.purchaseNumber || bill.billNumber}`;
                const partyName = isPur ? bill.supplierName : bill.customerName;
                const partyPhone = isPur ? bill.supplierPhone : bill.customerPhone;
                const billDateVal = bill.purchaseDate || bill.billDate;
                const billTotal = bill.todayTotal !== undefined && bill.todayTotal !== null ? bill.todayTotal : (bill.totalDebit || 0);
                const paidVal = isPur
                  ? (bill.varavu !== undefined ? bill.varavu : (bill.cashPaid || 0))
                  : (bill.varavu !== undefined ? bill.varavu : (bill.cashReceived || 0));

                return (
                  <div key={bill._id} className="p-4 space-y-3 hover:bg-emerald-50/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-num font-black text-[#034D28] text-base">
                            {billNum}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPur
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-emerald-100 text-[#034D28] border border-emerald-200'
                            }`}
                          >
                            {isPur ? 'Purchase / கொள்முதல்' : 'Sale / விற்பனை'}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              bill.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {bill.status === 'cancelled' ? 'Cancelled' : 'Active'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono-num mt-0.5">
                          {formatDate(billDateVal)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {bill.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleEditBill(bill)}
                            className="min-h-[38px] px-2.5 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Edit Bill"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintBill(bill)}
                          className="min-h-[38px] px-2.5 bg-emerald-100 text-[#034D28] hover:bg-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Print / View Bill"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        {bill.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCancellingBill(bill)}
                            className="min-h-[38px] p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Cancel Bill"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-gray-900 text-sm">{partyName}</div>
                      {partyPhone && (
                        <div className="text-xs text-gray-400 font-mono-num">{partyPhone}</div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-gray-500 block text-[11px]">Bags / Weight:</span>
                        <span className="font-mono-num font-bold text-gray-800">
                          {bill.totalBag || 0} bags • {formatNumber(bill.totalWeight || 0)} kg
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block text-[11px]">
                          {isPur ? 'Purchase Total:' : 'Today Total:'}
                        </span>
                        <span className="font-mono-num font-black text-gray-900 text-sm">
                          ₹{formatCurrency(billTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">
                          {isPur ? 'Amount Paid:' : 'Varavu (Received):'}
                        </span>
                        <span className="font-mono-num font-bold text-emerald-800">
                          {paidVal > 0 ? `₹${formatCurrency(paidVal)}` : '₹0.00'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block text-[11px]">Closing Balance:</span>
                        <span className="font-mono-num font-black text-[#034D28] text-sm">
                          ₹{formatCurrency(bill.closingBalance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  {activeTab === 'purchase' ? (
                    /* Dedicated Purchase Bills Table Columns */
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <th className="py-3 px-4">Purchase Bill No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4 text-center">Bags</th>
                      <th className="py-3 px-4 text-right">Weight (KG)</th>
                      <th className="py-3 px-4 text-right">Purchase Total (₹)</th>
                      <th className="py-3 px-4 text-right">Discount (₹)</th>
                      <th className="py-3 px-4 text-right">Amount Paid (₹)</th>
                      <th className="py-3 px-4 text-right">Closing Balance (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  ) : activeTab === 'customer' ? (
                    /* Customer Bills Table Columns (Preserved exactly as before) */
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <th className="py-3 px-4">Bill No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4 text-center">Bags</th>
                      <th className="py-3 px-4 text-right">Weight (Kg)</th>
                      <th className="py-3 px-4 text-right">Today Total (₹)</th>
                      <th className="py-3 px-4 text-right">Discount (₹)</th>
                      <th className="py-3 px-4 text-right">Varavu (₹)</th>
                      <th className="py-3 px-4 text-right">Closing Bal (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  ) : (
                    /* Unified Table Columns for All Bills */
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <th className="py-3 px-4">Bill No</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer / Supplier Name</th>
                      <th className="py-3 px-4 text-center">Bags</th>
                      <th className="py-3 px-4 text-right">Weight (Kg)</th>
                      <th className="py-3 px-4 text-right">Total (₹)</th>
                      <th className="py-3 px-4 text-right">Discount (₹)</th>
                      <th className="py-3 px-4 text-right">Paid / Varavu (₹)</th>
                      <th className="py-3 px-4 text-right">Closing Bal (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bills.map((bill) => {
                    const isPur = bill.billType === 'purchase' || bill.isPurchase || Boolean(bill.purchaseNumber);
                    const billNum = bill.purchaseNumberFormatted || bill.billNumberFormatted || `#${bill.purchaseNumber || bill.billNumber}`;
                    const partyName = isPur ? bill.supplierName : bill.customerName;
                    const partyPhone = isPur ? bill.supplierPhone : bill.customerPhone;
                    const billDateVal = bill.purchaseDate || bill.billDate;
                    const billTotal = bill.todayTotal !== undefined && bill.todayTotal !== null ? bill.todayTotal : (bill.totalDebit || 0);
                    const paidVal = isPur
                      ? (bill.varavu !== undefined ? bill.varavu : (bill.cashPaid || 0))
                      : (bill.varavu !== undefined ? bill.varavu : (bill.cashReceived || 0));

                    return (
                      <tr
                        key={bill._id}
                        className="hover:bg-emerald-50/30 transition-colors font-medium text-gray-900"
                      >
                        <td className="py-3 px-4 font-mono-num font-black text-[#034D28]">
                          {billNum}
                        </td>

                        {activeTab === 'all' && (
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isPur
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-emerald-100 text-[#034D28] border border-emerald-200'
                              }`}
                            >
                              {isPur ? 'Purchase' : 'Sale'}
                            </span>
                          </td>
                        )}

                        <td className="py-3 px-4 font-mono-num text-xs text-gray-600">
                          {formatDate(billDateVal)}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{partyName}</div>
                          {partyPhone && (
                            <div className="text-xs text-gray-400 font-mono-num">{partyPhone}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-mono-num font-bold">
                          {bill.totalBag || 0}
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num">
                          {formatNumber(bill.totalWeight || 0)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num font-bold text-gray-950">
                          ₹{formatCurrency(billTotal)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num text-amber-800 font-bold">
                          {bill.discount > 0 ? `₹${formatCurrency(bill.discount)}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num text-emerald-800 font-bold">
                          {paidVal > 0 ? `₹${formatCurrency(paidVal)}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num font-extrabold text-[#034D28]">
                          ₹{formatCurrency(bill.closingBalance || 0)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              bill.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-[#034D28]'
                            }`}
                          >
                            {bill.status === 'cancelled' ? 'Cancelled' : 'Active'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {bill.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleEditBill(bill)}
                                className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                title={isPur ? 'Edit Purchase Bill' : 'Edit Bill / பில் திருத்துதல்'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePrintBill(bill)}
                              className="p-1.5 bg-emerald-100 text-[#034D28] hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title={isPur ? 'Print / View Purchase Bill' : 'Print / View Bill'}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {bill.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => setCancellingBill(bill)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title={isPur ? 'Cancel Purchase Bill' : 'Cancel Bill'}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {page} of {totalPages} ({totalBills} total records)
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated A5 Print Modal (Handles both Customer and Supplier bills dynamically) */}
      <PrintModal
        isOpen={showPrintModal}
        bill={activeBill}
        settings={settings}
        onClose={() => setShowPrintModal(false)}
      />

      {/* Cancel Bill Confirmation Modal */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-gray-900">
                Cancel {cancellingBill.billType === 'purchase' || cancellingBill.isPurchase ? 'Purchase' : 'Customer'} Bill #{cancellingBill.purchaseNumberFormatted || cancellingBill.billNumberFormatted}?
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Cancelling this bill will automatically reverse the transaction amount from{' '}
              <strong>{cancellingBill.supplierName || cancellingBill.customerName}</strong>'s balance. This action cannot be undone.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Reason for Cancellation
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Duplicate entry, Incorrect particulars..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-red-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCancellingBill(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllBills;
