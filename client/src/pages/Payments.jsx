import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  CreditCard,
  QrCode,
  Banknote,
} from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../utils/math';
import CustomerAutocomplete from '../components/CustomerAutocomplete';

export const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modeFilter, setModeFilter] = useState('');

  // New Payment Form
  const [selectedCust, setSelectedCust] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (modeFilter) params.append('paymentMode', modeFilter);

      const res = await api.get(`/payments?${params.toString()}`);
      if (res.success) {
        setPayments(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/customers?activeOnly=true&limit=500').then((res) => {
      if (res.success) setCustomers(res.data);
    });
    fetchPayments();
  }, [startDate, endDate, modeFilter]);

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    if (!selectedCust?._id) {
      setError('Please select a customer');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    try {
      setFormLoading(true);
      setError('');
      const res = await api.post('/payments', {
        customerId: selectedCust._id,
        amount: Number(amount),
        paymentDate,
        paymentMode,
        referenceNumber: referenceNumber.trim(),
        remarks: remarks.trim(),
      });

      if (res.success) {
        setIsAddOpen(false);
        setSelectedCust(null);
        setAmount('');
        setReferenceNumber('');
        setRemarks('');
        fetchPayments();
      }
    } catch (err) {
      setError(err.message || 'Failed to save payment');
    } finally {
      setFormLoading(false);
    }
  };

  const handleVoidPayment = async (paymentId) => {
    const reason = window.prompt('Enter reason for voiding this payment:');
    if (reason !== null) {
      try {
        await api.post(`/payments/${paymentId}/void`, { reason });
        fetchPayments();
      } catch (err) {
        alert(err.message || 'Failed to void payment');
      }
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'UPI':
        return <QrCode className="w-3.5 h-3.5 text-purple-600" />;
      case 'Bank Transfer':
        return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Customer Payment Management / வரவு பதிவேடு
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Record standalone cash, UPI, and bank collections with balance reduction
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Record Direct Payment</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold font-mono-num"
          />
        </div>
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold font-mono-num"
          />
        </div>
        <div>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
          >
            <option value="">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI / GPay</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-semibold">
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="font-bold text-base text-gray-700">No payment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Resulting Balance (₹)</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono-num text-xs text-gray-600">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-mono-num font-bold text-[#034D28]">
                      PAY-{p.paymentNumber || p._id.slice(-4)}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {p.customerName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                        {getModeIcon(p.paymentMode)}
                        <span>{p.paymentMode}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-black text-emerald-800 text-base">
                      ₹{formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-gray-700">
                      ₹{formatCurrency(p.resultingBalance)}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {p.referenceNumber && <span className="font-mono-num font-semibold text-gray-700 block">Ref: {p.referenceNumber}</span>}
                      {p.remarks}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleVoidPayment(p._id)}
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-md font-bold transition-colors"
                      >
                        Void
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-[#034D28] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                Record Direct Customer Payment
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-5 space-y-3.5 text-sm">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <CustomerAutocomplete
                  customers={customers}
                  selectedCustomer={selectedCust}
                  onSelectCustomer={(c) => setSelectedCust(c)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Amount Received (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-mono-num font-extrabold text-lg text-emerald-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-mono-num font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-bold text-xs bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Reference No / UTR (Optional)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="UPI Ref ID, Cheque number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-semibold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Remarks / குறிப்பு
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Cleared Palani market balance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#034D28] text-white font-bold rounded-xl hover:bg-[#02361c] shadow-md disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
