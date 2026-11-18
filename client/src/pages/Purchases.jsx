import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
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
  Receipt,
  Printer,
  Calendar,
  X,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import api from '../api/axios';
import { useDebounce } from '../hooks/useDebounce';
import { formatCurrency, formatNumber } from '../utils/math';
import PrintModal from '../components/PrintModal';

export const Purchases = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'bills'

  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Purchase Bills state
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const debouncedPurchaseSearch = useDebounce(purchaseSearch, 300);
  const [selectedPrintPurchase, setSelectedPrintPurchase] = useState(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [historySupplier, setHistorySupplier] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Supplier Form State
  const [formData, setFormData] = useState({
    name: '',
    tamilName: '',
    phone: '',
    address: '',
    openingBalance: '',
    notes: '',
  });

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    referenceNumber: '',
    remarks: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Summary Metrics
  const totalOutstanding = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
  const activeCount = suppliers.filter((s) => s.isActive).length;

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/suppliers?search=${encodeURIComponent(debouncedSearch)}&activeOnly=all&limit=300`);
      if (res.success) {
        setSuppliers(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      setPurchasesLoading(true);
      const res = await api.get(`/purchases?search=${encodeURIComponent(debouncedPurchaseSearch)}&limit=100`);
      if (res.success) {
        setPurchases(res.data);
      }
    } catch (err) {
      console.warn('Failed to load purchases:', err);
    } finally {
      setPurchasesLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [debouncedSearch]);

  useEffect(() => {
    if (activeTab === 'bills') {
      fetchPurchases();
    }
  }, [activeTab, debouncedPurchaseSearch]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      tamilName: '',
      phone: '',
      address: '',
      openingBalance: '',
      notes: '',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      tamilName: supplier.tamilName || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      openingBalance: supplier.openingBalance || '',
      notes: supplier.notes || '',
    });
    setIsAddOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingSupplier) {
        const res = await api.put(`/suppliers/${editingSupplier._id}`, formData);
        if (res.success) {
          setSuppliers((prev) => prev.map((s) => (s._id === editingSupplier._id ? res.data : s)));
          setSuccessMsg('Supplier updated successfully');
        }
      } else {
        const res = await api.post('/suppliers', formData);
        if (res.success) {
          setSuppliers((prev) => [res.data, ...prev]);
          setSuccessMsg('Supplier added successfully');
        }
      }
      setIsAddOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save supplier');
    }
  };

  const handleOpenHistory = async (supplier) => {
    setHistorySupplier(supplier);
    try {
      setHistoryLoading(true);
      const res = await api.get(`/suppliers/${supplier._id}/history`);
      if (res.success) {
        setHistoryData(res.data.timeline || []);
      }
    } catch (err) {
      console.error('Failed to load supplier history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenPayment = (supplier) => {
    setPaymentSupplier(supplier);
    setPaymentForm({
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'Cash',
      referenceNumber: '',
      remarks: '',
    });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentSupplier || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) return;

    try {
      setPaymentSubmitting(true);
      const res = await api.post(`/suppliers/${paymentSupplier._id}/payments`, paymentForm);
      if (res.success) {
        setSuppliers((prev) =>
          prev.map((s) => (s._id === paymentSupplier._id ? { ...s, currentBalance: res.supplierBalance } : s))
        );
        setSuccessMsg(`Payment of ₹${formatCurrency(paymentForm.amount)} recorded successfully`);
        setPaymentSupplier(null);
        setTimeout(() => setSuccessMsg(''), 3500);
      }
    } catch (err) {
      setError(err.message || 'Failed to record supplier payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSupplier) return;
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/suppliers/${deletingSupplier._id}`);
      if (res.success) {
        setSuppliers((prev) => prev.filter((s) => s._id !== deletingSupplier._id));
        setSuccessMsg(res.message || 'Supplier removed');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
      setDeletingSupplier(null);
    } catch (err) {
      setError(err.message || 'Could not delete supplier');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePrintPurchase = async (purchase) => {
    try {
      const res = await api.get(`/purchases/${purchase._id}`);
      if (res.success) {
        const p = res.data;
        // Transform purchase to bill-compatible structure for PrintModal
        setSelectedPrintPurchase({
          ...p,
          billNumber: p.purchaseNumber,
          billNumberFormatted: p.purchaseNumberFormatted || `PUR-${String(p.purchaseNumber).padStart(4, '0')}`,
          customerName: p.supplierName,
          customerPhone: p.supplierPhone,
          billDate: p.purchaseDate,
          isPurchase: true,
        });
      }
    } catch (err) {
      console.error('Failed to load purchase for print:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header and Top Action Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Purchase Management / கொள்முதல்
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Manage suppliers, vegetable procurement, payments, and purchase ledgers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#034D28] hover:bg-[#02381c] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/new-bill?type=supplier')}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>New Purchase (F2)</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#034D28] text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center justify-between animate-in fade-in">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-md">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-200">
          <span className="text-[11px] font-bold text-gray-500 uppercase block">Active Suppliers</span>
          <span className="text-xl font-black text-gray-900 font-mono-num">{activeCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-200">
          <span className="text-[11px] font-bold text-gray-500 uppercase block">Total Outstanding Payable</span>
          <span className="text-xl font-black text-amber-900 font-mono-num">₹{formatCurrency(totalOutstanding)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-200 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase block">Total Suppliers Recorded</span>
          <span className="text-xl font-black text-[#034D28] font-mono-num">{suppliers.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 pt-2 rounded-t-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'border-[#034D28] text-[#034D28]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Suppliers List / சப்ளையர்கள் ({suppliers.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'bills'
              ? 'border-[#034D28] text-[#034D28]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Purchase Bills / கொள்முதல் பில்கள்</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'suppliers' ? (
        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200 p-4 space-y-4">
          {/* Search Box */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers by name or phone..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs font-bold focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
            />
          </div>

          {/* Suppliers Table */}
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-semibold animate-pulse">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No suppliers found. Click <strong>Add Supplier</strong> to add your first supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3 text-left">Supplier Name</th>
                    <th className="py-2.5 px-3 text-left">Tamil Name</th>
                    <th className="py-2.5 px-3 text-left">Mobile</th>
                    <th className="py-2.5 px-3 text-left">Address</th>
                    <th className="py-2.5 px-3 text-right">Outstanding (₹)</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((s, idx) => (
                    <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono-num text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          {!s.isActive && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-normal">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-tamil text-emerald-800 font-semibold">{s.tamilName || '-'}</td>
                      <td className="py-2.5 px-3 font-mono-num text-gray-600 font-bold">{s.phone || '-'}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{s.address || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-black text-amber-900 text-sm md:text-base">
                        ₹{formatCurrency(s.currentBalance || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(s)}
                            className="p-1.5 bg-emerald-50 text-[#034D28] hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            title="Transaction History / Ledger"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(s)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            title="Record Payment Made"
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSupplier(s)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete / Deactivate Supplier"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Purchase Bills Tab */
        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                placeholder="Search purchase bills by supplier or #..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs font-bold focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/new-bill?type=supplier')}
              className="px-3.5 py-2 bg-[#034D28] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Bill</span>
            </button>
          </div>

          {purchasesLoading ? (
            <div className="p-8 text-center text-gray-500 font-semibold animate-pulse">Loading purchase bills...</div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No purchase bills generated yet. Click <strong>Create Purchase Bill</strong> to record your first purchase.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-left">Bill #</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Supplier Name</th>
                    <th className="py-2.5 px-3 text-center">Bags</th>
                    <th className="py-2.5 px-3 text-center">Weight (kg)</th>
                    <th className="py-2.5 px-3 text-right">Today Total (₹)</th>
                    <th className="py-2.5 px-3 text-right">Cash Paid (₹)</th>
                    <th className="py-2.5 px-3 text-right">Closing Bal (₹)</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono-num font-bold text-[#034D28]">
                        {p.purchaseNumberFormatted || `PUR-${String(p.purchaseNumber).padStart(4, '0')}`}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-gray-600">
                        {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">{p.supplierName}</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">{p.totalBag || 0}</td>
                      <td className="py-2.5 px-3 text-center font-mono-num">{formatNumber(p.totalWeight || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-bold text-gray-900">
                        ₹{formatCurrency(p.todayTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-800 font-bold">
                        ₹{formatCurrency(p.cashPaid || p.varavu || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-black text-amber-900">
                        ₹{formatCurrency(p.closingBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintPurchase(p)}
                            className="p-1.5 bg-emerald-100 text-[#034D28] hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                            title="View / Print Purchase Bill"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/new-bill?edit=${p._id}&type=supplier`)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Purchase Bill"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-extrabold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Supplier Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ooty Farm Supplies"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:border-[#034D28] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tamil Name / தமிழ் பெயர் (Optional)
                </label>
                <input
                  type="text"
                  value={formData.tamilName}
                  onChange={(e) => setFormData({ ...formData, tamilName: e.target.value })}
                  placeholder="e.g. ஊட்டி சப்ளையர்ஸ்"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-tamil focus:border-[#034D28] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="10-digit mobile..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num focus:border-[#034D28] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address / ஊர்</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="City, Market or Stall..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-[#034D28] outline-none"
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Opening Balance (₹) (What we currently owe)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono-num focus:border-[#034D28] outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment terms, vegetable preferences..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:border-[#034D28] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#034D28] hover:bg-[#02381c] text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  {editingSupplier ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier History / Ledger Modal */}
      {historySupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] flex flex-col border border-gray-200">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  {historySupplier.name} {historySupplier.tamilName ? `(${historySupplier.tamilName})` : ''} - Supplier Ledger
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Outstanding Balance Owed:{' '}
                  <strong className="text-amber-900 text-sm font-mono-num">
                    ₹{formatCurrency(historySupplier.currentBalance || 0)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistorySupplier(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {historyLoading ? (
                <div className="p-8 text-center text-gray-500 font-semibold animate-pulse">
                  Loading ledger entries...
                </div>
              ) : historyData.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl">
                  No transaction history recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[10px]">
                        <th className="py-2 px-2.5 text-left">Date</th>
                        <th className="py-2 px-2.5 text-left">Type</th>
                        <th className="py-2 px-2.5 text-left">Reference / Particulars</th>
                        <th className="py-2 px-2.5 text-right text-red-700">Purchase (Debit +)</th>
                        <th className="py-2 px-2.5 text-right text-emerald-800">Paid (Credit -)</th>
                        <th className="py-2 px-2.5 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 px-2.5 font-mono-num text-gray-600">
                            {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="py-2 px-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                item.type === 'PURCHASE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.type === 'PAYMENT' || item.type === 'VARAVU'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-semibold text-gray-800">{item.description || item.reference}</td>
                          <td className="py-2 px-2.5 text-right font-mono-num font-bold text-amber-900">
                            {item.debit > 0 ? `₹${formatCurrency(item.debit)}` : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono-num font-bold text-emerald-800">
                            {item.credit > 0 ? `₹${formatCurrency(item.credit)}` : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono-num font-black text-gray-900">
                            ₹{formatCurrency(item.runningBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setHistorySupplier(null)}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Record Payment</h3>
                <p className="text-xs text-gray-500 font-medium">To: {paymentSupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentSupplier(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base font-black font-mono-num text-[#034D28] focus:border-[#034D28] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="Cash">Cash / ரொக்கம்</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">Bank Transfer / IMPS / NEFT</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Reference</label>
                <input
                  type="text"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  placeholder="Transaction ID, note..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-4 py-2 bg-[#034D28] hover:bg-[#02381c] text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 border border-gray-200">
            <h3 className="text-base font-extrabold text-gray-900">Remove Supplier</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to remove <strong>{deletingSupplier.name}</strong>? If this supplier has previous
              purchases or payments, they will be safely archived to preserve financial records.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteLoading ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal for Purchase Bills */}
      {selectedPrintPurchase && (
        <PrintModal
          isOpen={Boolean(selectedPrintPurchase)}
          onClose={() => setSelectedPrintPurchase(null)}
          bill={selectedPrintPurchase}
        />
      )}
    </div>
  );
};

export default Purchases;
