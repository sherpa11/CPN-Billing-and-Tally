import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, formatNumber } from '../utils/math';
import PrintModal from '../components/PrintModal';

export const AllBills = () => {
  const { settings } = useSettings();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
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

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page,
        limit: 25,
        status,
      });
      if (search.trim()) params.append('search', search.trim());
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
  }, [page, status, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const handlePrintBill = async (bill) => {
    try {
      const res = await api.get(`/bills/${bill._id}`);
      if (res.success && res.data) {
        setActiveBill(res.data);
      } else {
        setActiveBill(bill);
      }
      setShowPrintModal(true);
    } catch (e) {
      setActiveBill(bill);
      setShowPrintModal(true);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBill) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/bills/${cancellingBill._id}/cancel`, {
        reason: cancelReason || 'Cancelled from Bill Management',
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
              View, reprint, search, and manage historical vegetable market bills ({totalBills} total)
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Search by Customer or Bill Number */}
          <div className="md:col-span-4 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Customer name or Bill #..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:border-[#034D28] outline-none"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num font-bold focus:border-[#034D28] outline-none"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num font-bold focus:border-[#034D28] outline-none"
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
              className="flex-1 px-2.5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
            >
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-[#034D28] text-white rounded-xl font-bold text-xs hover:bg-[#02361c] transition-colors"
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
            <p className="font-bold text-base text-gray-700">No bills found</p>
            <p className="text-xs text-gray-500">Create a new bill from the New Bill tab</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
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
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((bill) => (
                  <tr
                    key={bill._id}
                    className="hover:bg-emerald-50/30 transition-colors font-medium text-gray-900"
                  >
                    <td className="py-3 px-4 font-mono-num font-black text-[#034D28]">
                      {bill.billNumberFormatted || `#${bill.billNumber}`}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-gray-600">
                      {formatDate(bill.billDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{bill.customerName}</div>
                      {bill.customerPhone && (
                        <div className="text-xs text-gray-400 font-mono-num">{bill.customerPhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono-num font-bold">
                      {bill.totalBag || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num">
                      {formatNumber(bill.totalWeight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-gray-950">
                      ₹{formatCurrency(bill.todayTotal !== undefined && bill.todayTotal !== null ? bill.todayTotal : bill.totalDebit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-amber-800 font-bold">
                      {bill.discount > 0 ? `₹${formatCurrency(bill.discount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-emerald-800 font-bold">
                      {(bill.varavu !== undefined ? bill.varavu : bill.cashReceived) > 0
                        ? `₹${formatCurrency(bill.varavu !== undefined ? bill.varavu : bill.cashReceived)}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-extrabold text-[#034D28]">
                      ₹{formatCurrency(bill.closingBalance)}
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
                        <button
                          type="button"
                          onClick={() => handlePrintBill(bill)}
                          className="p-1.5 bg-emerald-100 text-[#034D28] hover:bg-emerald-200 rounded-lg transition-colors"
                          title="Print / View Bill"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {bill.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCancellingBill(bill)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel Bill"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {page} of {totalPages} ({totalBills} total bills)
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated A5 Print Modal */}
      <PrintModal
        isOpen={showPrintModal}
        bill={activeBill}
        settings={settings}
        onClose={() => setShowPrintModal(false)}
      />

      {/* Cancel Bill Modal */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-gray-900">
                Cancel Bill #{cancellingBill.billNumberFormatted}?
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Cancelling this bill will automatically reverse the transaction amount from{' '}
              <strong>{cancellingBill.customerName}</strong>'s balance. This action cannot be undone.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Reason for Cancellation
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Duplicate entry, Wrong customer..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-red-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCancellingBill(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md disabled:opacity-50"
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
