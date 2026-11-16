import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  Eye,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calendar,
  UserCheck,
} from 'lucide-react';
import api from '../api/axios';
import { appCache } from '../services/cache';
import { useSettings } from '../context/SettingsContext';
import { round2, add2, sub2, mul2, formatCurrency, formatNumber } from '../utils/math';
import CustomerAutocomplete from '../components/CustomerAutocomplete';
import VegetableAutocomplete from '../components/VegetableAutocomplete';
import QuickAddVegetableModal from '../components/QuickAddVegetableModal';
import PrintModal from '../components/PrintModal';

const createEmptyRow = () => ({
  vegetable: null,
  particulars: '',
  tamilName: '',
  rate: '',
  bag: '',
  weight: '',
  amount: '',
});

export const NewBill = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  // Master lists
  const [vegetables, setVegetables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [nextBillInfo, setNextBillInfo] = useState({ nextBillNumber: 1, formattedBillNumber: 'CPN-0001' });

  // Bill Form State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [previousBalanceDate, setPreviousBalanceDate] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [varavu, setVaravu] = useState('');
  const [notes, setNotes] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [printModalBill, setPrintModalBill] = useState(null);
  const [autoPrint, setAutoPrint] = useState(false);

  // Quick Add Vegetable Modal state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState('');
  const [quickAddRowIndex, setQuickAddRowIndex] = useState(null);

  // Focus Refs grid: [rowIdx][colName]
  const customerInputRef = useRef(null);
  const cellRefs = useRef([]);

  // Fetch initial reference data with client-side caching
  useEffect(() => {
    const loadData = async () => {
      try {
        const cachedVeg = appCache.get('vegetables_active');
        if (cachedVeg && Array.isArray(cachedVeg)) {
          setVegetables(cachedVeg);
        }

        const promises = [
          api.get('/customers?activeOnly=true&limit=500'),
          api.get('/bills/next-number'),
        ];
        if (!cachedVeg) {
          promises.push(api.get('/vegetables?activeOnly=true'));
        }

        const results = await Promise.all(promises);
        const custRes = results[0];
        const billNumRes = results[1];
        const vegRes = !cachedVeg ? results[2] : null;

        if (custRes.success) setCustomers(custRes.data);
        if (billNumRes.success) setNextBillInfo(billNumRes);
        if (vegRes && vegRes.success) {
          setVegetables(vegRes.data);
          appCache.set('vegetables_active', vegRes.data, 10 * 60 * 1000);
        }
      } catch (err) {
        console.error('Failed to load initial billing data:', err);
        setError('Error connecting to server. Please refresh.');
      }
    };
    loadData();
  }, []);

  // When customer changes, automatically update Previous Balance & its Date instantly
  const handleSelectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone || '');
    setPreviousBalance(round2(cust.currentBalance || 0));

    if (cust.lastTransactionDate) {
      setPreviousBalanceDate(new Date(cust.lastTransactionDate).toISOString().split('T')[0]);
    } else if (cust.createdAt) {
      setPreviousBalanceDate(new Date(cust.createdAt).toISOString().split('T')[0]);
    } else if (cust._id) {
      // Background non-blocking fetch only if date is not available
      api.get(`/customers/${cust._id}`).then((res) => {
        if (res.success && res.data) {
          const d = res.data.lastBalanceDate || res.data.customer?.lastTransactionDate;
          if (d) setPreviousBalanceDate(new Date(d).toISOString().split('T')[0]);
          if (res.data.customer?.currentBalance !== undefined) {
            setPreviousBalance(round2(res.data.customer.currentBalance));
          }
        }
      }).catch((e) => console.warn('Could not load detailed balance:', e));
    } else {
      setPreviousBalanceDate('');
    }

    // Move focus to first vegetable particulars cell immediately
    setTimeout(() => {
      cellRefs.current[0]?.particulars?.focus();
    }, 10);
  };

  // Row update helper (functional update to prevent state clobbering)
  const handleRowChange = (index, field, value) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      if (index < 0 || index >= updated.length) return prevItems;

      const row = { ...updated[index], [field]: value };

      // In 5-column bill: Auto-compute Amount if rate or weight changes
      if (field === 'rate' || field === 'weight') {
        const r = Number(field === 'rate' ? value : row.rate) || 0;
        const w = Number(field === 'weight' ? value : row.weight) || 0;
        if (r > 0 && w > 0) {
          row.amount = mul2(r, w);
        } else if (r === 0 || w === 0) {
          row.amount = '';
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Dedicated atomic vegetable selection handler for a row
  const handleSelectVegetableForRow = (rowIndex, veg) => {
    if (!veg) return;
    const vegRate = veg.defaultRate > 0 ? String(veg.defaultRate) : '';

    setItems((prevItems) => {
      const updated = [...prevItems];
      if (rowIndex < 0 || rowIndex >= updated.length) return prevItems;

      const currentRow = updated[rowIndex] || createEmptyRow();
      const w = Number(currentRow.weight) || 0;
      const r = Number(vegRate) || 0;
      const newAmount = r > 0 && w > 0 ? mul2(r, w) : (r === 0 && w > 0 ? '' : currentRow.amount);

      updated[rowIndex] = {
        ...currentRow,
        vegetable: veg._id || null,
        particulars: veg.name || '',
        tamilName: veg.tamilName || '',
        rate: vegRate,
        amount: newAmount,
      };
      return updated;
    });
  };

  // Row addition
  const handleAddRow = () => {
    setItems((prev) => [...prev, createEmptyRow()]);
  };

  // Row deletion
  const handleDeleteRow = (index) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow()];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Quick Add Vegetable handler
  const handleOpenQuickAdd = (typedName, rowIndex) => {
    setQuickAddInitialName(typedName);
    setQuickAddRowIndex(rowIndex);
    setQuickAddOpen(true);
  };

  const handleVegetableAdded = (newVeg) => {
    appCache.invalidate('vegetables_active');
    // Add to master list
    setVegetables((prev) => [newVeg, ...prev]);

    // Update row atomically
    if (quickAddRowIndex !== null && quickAddRowIndex < items.length) {
      handleSelectVegetableForRow(quickAddRowIndex, newVeg);

      // Focus Bag or Rate cell of that row
      setTimeout(() => {
        if (newVeg.defaultRate > 0) {
          cellRefs.current[quickAddRowIndex]?.bag?.focus();
        } else {
          cellRefs.current[quickAddRowIndex]?.rate?.focus();
        }
      }, 50);
    }
    setQuickAddOpen(false);
  };

  // 6-Row Authoritative Summary Calculations
  let totalBag = 0;
  let totalWeight = 0;
  let todayTotal = 0;

  items.forEach((item) => {
    const b = Number(item.bag) || 0;
    const w = round2(item.weight || 0);
    const r = Number(item.rate) || 0;
    const a = round2(
      item.amount !== undefined && item.amount !== ''
        ? item.amount
        : r * w
    );

    totalBag += b;
    totalWeight = add2(totalWeight, w);
    todayTotal = add2(todayTotal, a);
  });

  const parsedPrevBalance = round2(previousBalance || 0);
  const parsedDiscount = round2(discount || 0);
  const parsedVaravu = round2(varavu !== '' ? varavu : cashReceived || 0);

  // 1. Today's Total = todayTotal
  // 2. Previous Balance = parsedPrevBalance
  // 3. Total = Today's Total + Previous Balance
  const total = add2(todayTotal, parsedPrevBalance);
  // 4. Discount = parsedDiscount
  // 5. Varavu = parsedVaravu
  // 6. Closing Balance = Total - Discount - Varavu
  const closingBalance = sub2(sub2(total, parsedDiscount), parsedVaravu);

  // Keyboard navigation across cells: RATE -> PARTICULARS -> BAG -> WEIGHT -> AMOUNT -> next row RATE
  const handleCellKeyDown = (e, rowIndex, colName) => {
    // IME safety: If user is actively typing Tamil using an IME, do not intercept Enter
    if (e.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const colOrder = ['rate', 'particulars', 'bag', 'weight', 'amount'];
      const curColIdx = colOrder.indexOf(colName);

      if (curColIdx < colOrder.length - 1) {
        // Move to next cell in current row
        const nextCol = colOrder[curColIdx + 1];
        cellRefs.current[rowIndex]?.[nextCol]?.focus();
      } else {
        // We are on 'amount' (last column of row) -> advance to next row's rate
        if (rowIndex < items.length - 1) {
          cellRefs.current[rowIndex + 1]?.rate?.focus();
        } else {
          // If on last row, append new row and focus its rate
          const newRows = [...items, createEmptyRow()];
          setItems(newRows);
          setTimeout(() => {
            cellRefs.current[newRows.length - 1]?.rate?.focus();
          }, 30);
        }
      }
    }
  };

  // Reset Form
  const handleReset = () => {
    if (window.confirm('Clear current bill form?')) {
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setPreviousBalance(0);
      setPreviousBalanceDate('');
      setCashReceived('');
      setDiscount('');
      setVaravu('');
      setNotes('');
      setItems([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
      setError('');
      setSuccessMsg('');
      api.get('/bills/next-number').then((res) => {
        if (res.success) setNextBillInfo(res);
      });
      customerInputRef.current?.focus();
    }
  };

  // Submit Bill (Optimized Save & New Workflow)
  const handleSubmitBill = async (options = { autoPrint: false }) => {
    if (loading) return null; // Prevent duplicate submissions

    const finalCustName = customerName.trim() || selectedCustomer?.name || '';
    if (!finalCustName) {
      setError('Please select or enter customer name');
      return null;
    }

    const validItems = items
      .map((it) => {
        const r = Number(it.rate) || 0;
        const w = Number(it.weight) || 0;
        const a = round2(
          it.amount !== undefined && it.amount !== ''
            ? it.amount
            : r * w
        );
        return {
          ...it,
          particulars: it.particulars?.trim() || (a > 0 || r > 0 ? 'Vegetables' : ''),
          amount: a,
        };
      })
      .filter((it) => it.particulars?.trim() || Number(it.amount) > 0);

    if (validItems.length === 0) {
      setError('Please enter at least one vegetable item');
      return null;
    }

    try {
      setLoading(true);
      setError('');

      const billPayload = {
        customerId: selectedCustomer?._id || null,
        customerName: finalCustName,
        customerPhone: customerPhone.trim(),
        billDate,
        items: validItems.map((it) => ({
          vegetable: it.vegetable || null,
          particulars: it.particulars.trim(),
          tamilName: (it.tamilName || '').trim(),
          rate: Number(it.rate) || 0,
          bag: Number(it.bag) || 0,
          weight: Number(it.weight) || 0,
          amount: Number(it.amount) || 0,
        })),
        previousBalance: parsedPrevBalance,
        previousBalanceDate: previousBalanceDate || null,
        discount: parsedDiscount,
        varavu: parsedVaravu,
        cashReceived: parsedVaravu,
        todayTotal,
        grandTotal: total,
        closingBalance,
        billVersion: 'v3_new_6row',
        notes: notes.trim(),
      };

      const res = await api.post('/bills', billPayload);

      if (res.success && res.data) {
        setSuccessMsg(`Bill #${res.data.billNumberFormatted} saved successfully!`);

        // Optimistically increment next bill number locally
        if (res.data.billNumber) {
          const nextNum = res.data.billNumber + 1;
          const prefix = settings.billPrefix || 'CPN';
          setNextBillInfo({
            nextBillNumber: nextNum,
            formattedBillNumber: `${prefix}-${String(nextNum).padStart(4, '0')}`,
          });
        }

        // Background synchronization
        api.get('/bills/next-number').then((nRes) => {
          if (nRes.success) setNextBillInfo(nRes);
        });

        if (options.autoPrint) {
          setAutoPrint(true);
          setPrintModalBill(res.data);
        } else {
          // Instant form reset for seamless Save & New continuous billing
          setSelectedCustomer(null);
          setCustomerName('');
          setCustomerPhone('');
          setPreviousBalance(0);
          setPreviousBalanceDate('');
          setCashReceived('');
          setDiscount('');
          setVaravu('');
          setNotes('');
          setItems([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
          customerInputRef.current?.focus();
        }

        return res.data;
      }
    } catch (err) {
      setError(err.message || 'Failed to save bill');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleClosePrintModal = () => {
    setPrintModalBill(null);
    setAutoPrint(false);
    // Reset form for next customer
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setPreviousBalance(0);
    setPreviousBalanceDate('');
    setCashReceived('');
    setDiscount('');
    setVaravu('');
    setNotes('');
    setItems([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Top Banner & Quick Shortcuts Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                New Vegetable Bill / புதிய பில்
              </h1>
              <span className="bg-[#034D28] text-white text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                {nextBillInfo.formattedBillNumber}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              Enter key navigates columns. Select or add vegetables dynamically.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
            title="Clear Form (Esc)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmitBill({ autoPrint: false })}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-[#034D28] bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[42px] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save & New</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmitBill({ autoPrint: true })}
            disabled={loading}
            className="flex-1 sm:flex-none px-5 py-2 text-xs font-black text-white bg-[#034D28] hover:bg-[#02361c] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[42px] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2 animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#034D28] flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Customer & Bill Meta Details Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Customer Search Autocomplete */}
        <div className="md:col-span-6 space-y-1">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Customer / திரு: <span className="text-red-500">*</span>
          </label>
          <CustomerAutocomplete
            inputRef={customerInputRef}
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
            onTextChange={(val) => setCustomerName(val)}
            onEnterNext={() => cellRefs.current[0]?.particulars?.focus()}
          />
        </div>

        {/* Customer Phone (Optional display/edit) */}
        <div className="md:col-span-3 space-y-1">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Phone / தொலைபேசி
          </label>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Mobile number..."
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] text-sm font-mono-num font-semibold text-gray-800 outline-none"
          />
        </div>

        {/* Bill Date */}
        <div className="md:col-span-3 space-y-1">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Date / தேதி:
          </label>
          <div className="relative">
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] text-sm font-mono-num font-bold text-gray-900 outline-none"
            />
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Billing Table Card - Exact 5 Columns (Desktop View) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#034D28] text-white font-extrabold uppercase text-xs tracking-wider">
                <th className="py-2.5 px-3 w-[13%] text-center">விலை / RATE (₹)</th>
                <th className="py-2.5 px-3 w-[41%] text-left">பொருள் / PARTICULARS</th>
                <th className="py-2.5 px-3 w-[12%] text-center">பை / BAG</th>
                <th className="py-2.5 px-3 w-[15%] text-right">எடை / WEIGHT (Kg)</th>
                <th className="py-2.5 px-3 w-[15%] text-right">தொகை / AMOUNT (₹)</th>
                <th className="py-2.5 px-2 w-[4%] text-center no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row, idx) => {
                if (!cellRefs.current[idx]) cellRefs.current[idx] = {};
                return (
                  <tr
                    key={idx}
                    className="hover:bg-emerald-50/30 transition-colors focus-within:bg-emerald-50/50"
                  >
                    {/* 1. RATE / விலை */}
                    <td className="p-1.5 text-center">
                      <input
                        ref={(el) => (cellRefs.current[idx].rate = el)}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.rate}
                        onChange={(e) => handleRowChange(idx, 'rate', e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, 'rate')}
                        placeholder="0.00"
                        className="w-full text-center py-1.5 px-2 font-mono-num font-bold text-gray-900 border border-gray-200 rounded-lg focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm"
                      />
                    </td>

                    {/* 2. PARTICULARS / பொருள் */}
                    <td className="p-1.5">
                      <VegetableAutocomplete
                        inputRef={(el) => (cellRefs.current[idx].particulars = el)}
                        value={row.particulars}
                        vegetables={vegetables}
                        onChange={(val) => {
                          handleRowChange(idx, 'particulars', val);
                          if (!val) {
                            handleRowChange(idx, 'vegetable', null);
                            handleRowChange(idx, 'tamilName', '');
                          }
                        }}
                        onSelect={(veg) => {
                          handleSelectVegetableForRow(idx, veg);
                          // Auto focus next cell: Bag if rate populated, otherwise Rate
                          setTimeout(() => {
                            if (veg.defaultRate > 0) {
                              cellRefs.current[idx]?.bag?.focus();
                            } else {
                              cellRefs.current[idx]?.rate?.focus();
                            }
                          }, 50);
                        }}
                        onOpenQuickAdd={(typed) => handleOpenQuickAdd(typed, idx)}
                        onEnterNext={() => {
                          cellRefs.current[idx]?.bag?.focus();
                        }}
                      />
                    </td>

                    {/* 3. BAG / பை */}
                    <td className="p-1.5 text-center">
                      <input
                        ref={(el) => (cellRefs.current[idx].bag = el)}
                        type="number"
                        min="0"
                        value={row.bag}
                        onChange={(e) => handleRowChange(idx, 'bag', e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, 'bag')}
                        placeholder="0"
                        className="w-full text-center py-1.5 px-2 font-mono-num font-bold text-gray-900 border border-gray-200 rounded-lg focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm"
                      />
                    </td>

                    {/* 4. WEIGHT / எடை */}
                    <td className="p-1.5 text-right">
                      <input
                        ref={(el) => (cellRefs.current[idx].weight = el)}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.weight}
                        onChange={(e) => handleRowChange(idx, 'weight', e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, 'weight')}
                        placeholder="0.00"
                        className="w-full text-right py-1.5 px-2 font-mono-num font-bold text-gray-900 border border-gray-200 rounded-lg focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm"
                      />
                    </td>

                    {/* 5. AMOUNT / தொகை (Auto-computed from Rate × Weight, or manually entered) */}
                    <td className="p-1.5 text-right">
                      <input
                        ref={(el) => (cellRefs.current[idx].amount = el)}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, 'amount')}
                        placeholder="0.00"
                        className="w-full text-right py-1.5 px-2 font-mono-num font-extrabold text-gray-950 border border-gray-200 rounded-lg focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm bg-emerald-50/20"
                      />
                    </td>

                    {/* Delete button */}
                    <td className="p-1.5 text-center no-print">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded-md transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* TOTALS & 5-ROW SUMMARY FOOTER */}
            <tfoot>
              {/* Row: Add Row Quick Bar */}
              <tr className="border-t border-gray-200 bg-gray-50/70 no-print">
                <td colSpan={6} className="p-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#034D28] text-[#034D28] hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item Row (Enter on last field)</span>
                  </button>
                </td>
              </tr>

              {/* TOTAL ROW */}
              <tr className="bg-[#034D28]/10 border-t-2 border-b border-[#034D28] font-black text-sm text-[#034D28]">
                <td className="py-2.5 px-3 text-center">&nbsp;</td>
                <td className="py-2.5 px-3 text-center tracking-widest text-base font-black">
                  TOTAL / மொத்தம்
                </td>
                <td className="py-2.5 px-3 text-center font-mono-num text-base font-black">
                  {totalBag > 0 ? totalBag : '0'}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-num text-base font-black">
                  {formatNumber(totalWeight)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-num text-base font-black text-gray-950">
                  ₹{formatCurrency(todayTotal)}
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 1. TODAY'S TOTAL / இன்றைய மொத்தம் */}
              <tr className="border-b border-gray-200 bg-white font-bold text-sm">
                <td className="py-2.5 px-3">&nbsp;</td>
                <td colSpan={3} className="py-2.5 px-3 text-left font-bold text-gray-800">
                  1. இன்றைய மொத்தம் : (Today's Total)
                </td>
                <td className="py-2.5 px-3 text-right font-mono-num font-black text-gray-900">
                  ₹{formatCurrency(todayTotal)}
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 2. PREVIOUS BALANCE / முன் பாக்கி (With Date) */}
              <tr className="border-b border-gray-200 bg-white font-bold text-sm">
                <td className="py-2.5 px-3">&nbsp;</td>
                <td colSpan={3} className="py-2.5 px-3 text-left">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-gray-800">
                    <span>2. முன் பாக்கி : (தேதி :</span>
                    <input
                      type="date"
                      value={previousBalanceDate}
                      onChange={(e) => setPreviousBalanceDate(e.target.value)}
                      className="px-2 py-0.5 text-xs font-mono-num font-bold text-gray-800 border border-gray-300 rounded focus:border-[#034D28] outline-none"
                    />
                    <span>)</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={previousBalance}
                    onChange={(e) => setPreviousBalance(Number(e.target.value) || 0)}
                    className="w-full text-right py-1 px-2 font-mono-num font-bold text-gray-900 border border-gray-200 rounded-lg focus:border-[#034D28] outline-none text-sm"
                  />
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 3. TOTAL / மொத்தம் (Highlighted in Light Green #d1fae5) */}
              <tr className="border-b border-emerald-300 bg-[#d1fae5] font-black text-sm text-[#034D28]">
                <td className="py-2.5 px-3">&nbsp;</td>
                <td colSpan={3} className="py-2.5 px-3 text-left tracking-wide font-black">
                  3. மொத்தம் : (Total = Today's Total + Previous Balance)
                </td>
                <td className="py-2.5 px-3 text-right font-mono-num text-base font-black text-[#034D28]">
                  ₹{formatCurrency(total)}
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 4. DISCOUNT / தள்ளுபடி */}
              <tr className="border-b border-gray-200 bg-white font-bold text-sm">
                <td className="py-2.5 px-3">&nbsp;</td>
                <td colSpan={3} className="py-2.5 px-3 text-left font-bold text-gray-800">
                  4. தள்ளுபடி : (Discount)
                </td>
                <td className="py-2.5 px-3 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-right py-1 px-2 font-mono-num font-extrabold text-amber-900 border-2 border-amber-300 rounded-lg focus:border-[#034D28] outline-none text-sm bg-amber-50/50"
                  />
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 5. VARAVU / வரவு */}
              <tr className="border-b border-gray-200 bg-white font-bold text-sm">
                <td className="py-2.5 px-3">&nbsp;</td>
                <td colSpan={3} className="py-2.5 px-3 text-left font-bold text-gray-800">
                  5. வரவு : (Varavu / Cash Received)
                </td>
                <td className="py-2.5 px-3 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={varavu}
                    onChange={(e) => {
                      setVaravu(e.target.value);
                      setCashReceived(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full text-right py-1 px-2 font-mono-num font-extrabold text-emerald-800 border-2 border-emerald-400 rounded-lg focus:border-[#034D28] outline-none text-sm bg-emerald-50/50"
                  />
                </td>
                <td className="no-print"></td>
              </tr>

              {/* 6. FINAL OUTSTANDING BALANCE / மொத்த பாக்கி (Highlighted in Light Green #d1fae5 with Bold Green Text) */}
              <tr className="bg-[#d1fae5] border-t-2 border-b-2 border-[#034D28] font-black text-base text-[#034D28]">
                <td className="py-3 px-3">&nbsp;</td>
                <td colSpan={3} className="py-3 px-3 text-left tracking-wider font-black uppercase text-[#034D28]">
                  6. மொத்த பாக்கி : (Final Balance = Total - Discount - Varavu)
                </td>
                <td className="py-3 px-3 text-right font-mono-num text-lg font-black text-[#034D28]">
                  ₹{formatCurrency(closingBalance)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile Item Entry Cards & Mobile Summary (Visible strictly on screens < 768px) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Bill Items ({items.length})
          </span>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>

        {items.map((row, idx) => (
          <div
            key={idx}
            className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200 space-y-2.5 focus-within:border-[#034D28] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#034D28] text-xs font-black flex items-center justify-center font-mono-num">
                  {idx + 1}
                </span>
                {row.tamilName && (
                  <span className="text-xs font-tamil font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {row.tamilName}
                  </span>
                )}
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteRow(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                  title="Remove row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Particulars (Vegetable Autocomplete) - Full Width on Mobile */}
            <div>
              <label className="text-[11px] font-bold text-gray-600 uppercase block mb-1">
                பொருள் / Vegetable
              </label>
              <VegetableAutocomplete
                value={row.particulars}
                vegetables={vegetables}
                onChange={(val) => {
                  handleRowChange(idx, 'particulars', val);
                  if (!val) {
                    handleRowChange(idx, 'vegetable', null);
                    handleRowChange(idx, 'tamilName', '');
                  }
                }}
                onSelect={(veg) => handleSelectVegetableForRow(idx, veg)}
                onOpenQuickAdd={(typed) => handleOpenQuickAdd(typed, idx)}
              />
            </div>

            {/* Numeric Inputs Grid (Rate, Bag, Weight, Amount) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                  விலை / Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.rate}
                  onChange={(e) => handleRowChange(idx, 'rate', e.target.value)}
                  placeholder="0.00"
                  className="w-full text-center py-2 px-2.5 font-mono-num font-bold text-gray-900 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm min-h-[42px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                  பை / Bag
                </label>
                <input
                  type="number"
                  min="0"
                  value={row.bag}
                  onChange={(e) => handleRowChange(idx, 'bag', e.target.value)}
                  placeholder="0"
                  className="w-full text-center py-2 px-2.5 font-mono-num font-bold text-gray-900 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm min-h-[42px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                  எடை / Wt (Kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.weight}
                  onChange={(e) => handleRowChange(idx, 'weight', e.target.value)}
                  placeholder="0.00"
                  className="w-full text-right py-2 px-2.5 font-mono-num font-bold text-gray-900 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm min-h-[42px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#034D28] uppercase block mb-1">
                  தொகை / Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full text-right py-2 px-2.5 font-mono-num font-black text-[#034D28] border-2 border-emerald-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm bg-emerald-50/40 min-h-[42px]"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddRow}
          className="w-full py-3 bg-white border border-[#034D28] text-[#034D28] hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs min-h-[44px] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Another Vegetable Row</span>
        </button>

        {/* Mobile Financial Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
          <h3 className="font-black text-sm text-gray-900 uppercase tracking-wide border-b pb-2">
            Bill Summary / பில் கணக்கு
          </h3>

          <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
            <span className="font-bold text-gray-700">1. இன்றைய மொத்தம் (Today's Total)</span>
            <span className="font-mono-num font-black text-gray-900 text-base">₹{formatCurrency(todayTotal)}</span>
          </div>

          <div className="space-y-1.5 py-1 border-b border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-700">2. முன் பாக்கி (Previous Balance)</span>
              <span className="font-mono-num font-bold text-gray-800">₹{formatCurrency(parsedPrevBalance)}</span>
            </div>
            {previousBalanceDate && (
              <div className="text-[11px] text-gray-500 font-mono-num text-right">
                As of: {previousBalanceDate}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-sm py-2 px-3 bg-[#d1fae5] rounded-xl border border-emerald-300">
            <span className="font-black text-[#034D28]">3. மொத்தம் (Total = Today + Prev)</span>
            <span className="font-mono-num font-black text-[#034D28] text-base">₹{formatCurrency(total)}</span>
          </div>

          <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100 gap-2">
            <span className="font-bold text-gray-700">4. தள்ளுபடி (Discount)</span>
            <div className="w-32">
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="w-full text-right py-1.5 px-2.5 font-mono-num font-bold text-amber-900 border-2 border-amber-300 rounded-lg outline-none text-sm bg-amber-50/50"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-sm py-1 border-b border-gray-100 gap-2">
            <span className="font-bold text-gray-700">5. வரவு (Cash Received)</span>
            <div className="w-32">
              <input
                type="number"
                step="0.01"
                min="0"
                value={varavu}
                onChange={(e) => {
                  setVaravu(e.target.value);
                  setCashReceived(e.target.value);
                }}
                placeholder="0.00"
                className="w-full text-right py-1.5 px-2.5 font-mono-num font-bold text-emerald-800 border-2 border-emerald-400 rounded-lg outline-none text-sm bg-emerald-50/50"
              />
            </div>
          </div>

          <div className="flex justify-between items-center py-2.5 px-3 bg-[#d1fae5] rounded-xl border-2 border-[#034D28]">
            <span className="font-black text-sm uppercase text-[#034D28]">6. இறுதி மொத்தம் (Closing)</span>
            <span className="font-mono-num font-black text-[#034D28] text-lg">₹{formatCurrency(closingBalance)}</span>
          </div>
        </div>
      </div>

      {/* Quick Add Vegetable Modal */}
      <QuickAddVegetableModal
        isOpen={quickAddOpen}
        initialName={quickAddInitialName}
        onClose={() => setQuickAddOpen(false)}
        onVegetableAdded={handleVegetableAdded}
      />

      {/* Dedicated A5 Print Modal */}
      <PrintModal
        isOpen={Boolean(printModalBill)}
        bill={printModalBill}
        settings={settings}
        autoPrint={autoPrint}
        onClose={handleClosePrintModal}
      />
    </div>
  );
};

export default NewBill;
