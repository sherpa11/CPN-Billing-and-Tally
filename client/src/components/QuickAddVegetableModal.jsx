import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Sparkles, Check } from 'lucide-react';
import api from '../api/axios';

export const QuickAddVegetableModal = ({
  isOpen,
  initialName = '',
  onClose,
  onVegetableAdded,
}) => {
  const [name, setName] = useState('');
  const [tamilName, setTamilName] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [unit, setUnit] = useState('Kg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setTamilName('');
      setDefaultRate('');
      setUnit('Kg');
      setError('');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Please enter vegetable name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.post('/vegetables/quick-add', {
        name: name.trim(),
        tamilName: tamilName.trim(),
        defaultRate: Number(defaultRate) || 0,
        unit: unit || 'Kg',
      });

      if (res.success && res.data) {
        onVegetableAdded(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save vegetable');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // IME safety: if composing Tamil or Indic text, return early
    if (e.isComposing || e.keyCode === 229) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border-2 border-[#034D28] w-full max-w-md overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="bg-[#034D28] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <h2 id="modal-title" className="text-lg font-bold">
              Add New Vegetable / புதிய காய்
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Vegetable Name (English) <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chow Chow, Green Peas, Lemon..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-2 focus:ring-[#034D28]/20 text-gray-900 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Tamil Name (தமிழ் பெயர்)
            </label>
            <input
              type="text"
              value={tamilName}
              onChange={(e) => setTamilName(e.target.value)}
              placeholder="e.g. சௌ சௌ, பட்டாணி..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-2 focus:ring-[#034D28]/20 text-gray-900 font-tamil font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Default Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-2 focus:ring-[#034D28]/20 text-gray-900 font-mono-num font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-2 focus:ring-[#034D28]/20 text-gray-900 font-semibold bg-white"
              >
                <option value="Kg">Kg</option>
                <option value="Bag">Bag (மூட்டை)</option>
                <option value="Box">Box (பெட்டி)</option>
                <option value="Piece">Piece (எண்ணிக்கை)</option>
                <option value="Bunch">Bunch (கட்டு)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 text-sm font-bold bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save & Select in Bill
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddVegetableModal;
