import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  RefreshCw,
  Wallet,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { useDebounce } from '../hooks/useDebounce';
import { formatCurrency } from '../utils/math';

export const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [error, setError] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    tamilName: '',
    phone: '',
    address: '',
    marketStall: '',
    openingBalance: '',
    notes: '',
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers?search=${encodeURIComponent(debouncedSearch)}&activeOnly=all&limit=200`);
      if (res.success) {
        setCustomers(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [debouncedSearch]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      tamilName: '',
      phone: '',
      address: '',
      marketStall: '',
      openingBalance: '',
      notes: '',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      tamilName: customer.tamilName || '',
      phone: customer.phone || '',
      address: customer.address || '',
      marketStall: customer.marketStall || '',
      openingBalance: customer.openingBalance || '',
      notes: customer.notes || '',
    });
    setIsAddOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer._id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setIsAddOpen(false);
      fetchCustomers();
    } catch (err) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleOpenLedger = async (customer) => {
    setLedgerCustomer(customer);
    try {
      setLedgerLoading(true);
      const res = await api.get(`/customers/${customer._id}/ledger`);
      if (res.success) {
        setLedgerData(res.ledger || []);
      }
    } catch (err) {
      alert(err.message || 'Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleReconcile = async (customerId) => {
    try {
      const res = await api.post(`/customers/${customerId}/reconcile`);
      if (res.success) {
        alert(`Reconciled! Balance is ₹${formatCurrency(res.reconciledBalance)}`);
        fetchCustomers();
        if (ledgerCustomer && ledgerCustomer._id === customerId) {
          handleOpenLedger(ledgerCustomer);
        }
      }
    } catch (err) {
      alert(err.message || 'Reconciliation failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/customers/${deletingCustomer._id}`);
      if (res.success) {
        const deletedName = deletingCustomer.name;
        setDeletingCustomer(null);
        if (ledgerCustomer && ledgerCustomer._id === deletingCustomer._id) {
          setLedgerCustomer(null);
        }
        await fetchCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete customer');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Customer Management & Ledger / வாடிக்கையாளர்
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Manage wholesale buyers, balances, and transaction history
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="relative max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, Tamil name, or mobile..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:border-[#034D28] outline-none"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Customers List Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-semibold bg-white rounded-2xl">
          Loading customers...
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="font-bold text-base text-gray-700">No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((cust) => (
            <div
              key={cust._id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 hover:border-[#034D28]/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-base text-gray-900 leading-tight">
                      {cust.name}
                    </h3>
                    {cust.tamilName && (
                      <p className="text-xs text-emerald-800 font-tamil font-semibold">
                        {cust.tamilName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Balance
                    </span>
                    <span
                      className={`text-sm font-black font-mono-num ${
                        cust.currentBalance > 0
                          ? 'text-amber-700'
                          : cust.currentBalance < 0
                          ? 'text-emerald-700'
                          : 'text-gray-600'
                      }`}
                    >
                      ₹{formatCurrency(cust.currentBalance)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-600 my-2">
                  {cust.phone && (
                    <div className="flex items-center gap-1.5 font-mono-num">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{cust.phone}</span>
                    </div>
                  )}
                  {cust.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{cust.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenLedger(cust)}
                  className="px-3 py-1.5 bg-emerald-50 text-[#034D28] hover:bg-emerald-100 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ledger</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleReconcile(cust._id)}
                    className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Reconcile balance against transactions"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cust)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Customer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCustomer(cust)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="bg-[#034D28] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Customer Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Murugan Traders"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Tamil Name (தமிழ் பெயர்)
                </label>
                <input
                  type="text"
                  value={formData.tamilName}
                  onChange={(e) => setFormData({ ...formData, tamilName: e.target.value })}
                  placeholder="e.g. முருகன் டிரேடர்ஸ்"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-tamil font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="98765 43210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-mono-num font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-mono-num font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Address / Market Stall
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Stall 14, Gandhi Market, Dindigul"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-semibold"
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
                  className="px-5 py-2 bg-[#034D28] text-white font-bold rounded-xl hover:bg-[#02361c] shadow-md"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Modal */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900">
                  Customer Ledger: {ledgerCustomer.name}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Current Balance: <strong className="text-[#034D28]">₹{formatCurrency(ledgerCustomer.currentBalance)}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingCustomer(ledgerCustomer)}
                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Delete this customer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerCustomer(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {ledgerLoading ? (
              <div className="p-8 text-center text-gray-500 font-semibold">
                Loading ledger timeline...
              </div>
            ) : ledgerData.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No transaction history found for this customer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-600 font-bold uppercase text-[11px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ledgerData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono-num text-gray-500">
                          {new Date(row.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3 font-bold text-gray-800">
                          {row.reference}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {row.description}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-gray-900">
                          {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-emerald-800">
                          {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-extrabold text-[#034D28]">
                          ₹{formatCurrency(row.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-red-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">
                  Delete Customer?
                </h3>
                <p className="text-xs text-gray-500">
                  This customer will be removed from your website.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Customer Name:</span>
                <strong className="text-gray-900 text-sm">{deletingCustomer.name}</strong>
              </div>
              {deletingCustomer.tamilName && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Tamil Name:</span>
                  <span className="text-emerald-800 font-tamil font-bold">{deletingCustomer.tamilName}</span>
                </div>
              )}
              {deletingCustomer.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Phone:</span>
                  <span className="font-mono-num font-semibold">{deletingCustomer.phone}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="text-gray-500 font-semibold">Current Balance:</span>
                <span
                  className={`font-mono-num font-black ${
                    deletingCustomer.currentBalance > 0
                      ? 'text-amber-700'
                      : deletingCustomer.currentBalance < 0
                      ? 'text-emerald-700'
                      : 'text-gray-700'
                  }`}
                >
                  ₹{formatCurrency(deletingCustomer.currentBalance)}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete <strong>{deletingCustomer.name}</strong>? They will be removed from customer management, billing search, and reports.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
