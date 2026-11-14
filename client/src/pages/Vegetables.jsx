import React, { useState, useEffect } from 'react';
import {
  Carrot,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  X,
  TrendingUp,
} from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../utils/math';

export const Vegetables = () => {
  const [vegetables, setVegetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVeg, setEditingVeg] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    tamilName: '',
    defaultRate: '',
    unit: 'Kg',
    isActive: true,
  });

  const fetchVegetables = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/vegetables?search=${encodeURIComponent(search)}&activeOnly=${activeFilter}`);
      if (res.success) {
        setVegetables(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch vegetables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVegetables();
  }, [search, activeFilter]);

  const handleOpenAdd = () => {
    setEditingVeg(null);
    setFormData({
      name: '',
      tamilName: '',
      defaultRate: '',
      unit: 'Kg',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (veg) => {
    setEditingVeg(veg);
    setFormData({
      name: veg.name || '',
      tamilName: veg.tamilName || '',
      defaultRate: veg.defaultRate || '',
      unit: veg.unit || 'Kg',
      isActive: veg.isActive !== undefined ? veg.isActive : true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingVeg) {
        await api.put(`/vegetables/${editingVeg._id}`, formData);
      } else {
        await api.post('/vegetables', formData);
      }
      setIsModalOpen(false);
      fetchVegetables();
    } catch (err) {
      alert(err.message || 'Failed to save vegetable');
    }
  };

  const handleToggleActive = async (veg) => {
    try {
      await api.put(`/vegetables/${veg._id}`, { isActive: !veg.isActive });
      fetchVegetables();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (veg) => {
    if (window.confirm(`Delete "${veg.name}" from active vegetable master?`)) {
      try {
        await api.delete(`/vegetables/${veg._id}`);
        fetchVegetables();
      } catch (err) {
        alert(err.message || 'Failed to delete');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
            <Carrot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Vegetable Master / காய்கறி விபரம்
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Manage unlimited wholesale vegetables with Tamil & English names ({vegetables.length} total)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vegetable</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vegetable in English or Tamil..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:border-[#034D28] outline-none"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white"
          >
            <option value="true">Active Only</option>
            <option value="all">All Vegetables</option>
          </select>
        </div>
      </div>

      {/* Vegetables List Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-semibold bg-white rounded-2xl">
          Loading vegetables...
        </div>
      ) : vegetables.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">
          <Carrot className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="font-bold text-base text-gray-700">No vegetables found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {vegetables.map((veg) => (
            <div
              key={veg._id}
              className={`bg-white p-3.5 rounded-2xl shadow-sm border transition-all flex flex-col justify-between ${
                veg.isActive ? 'border-gray-200 hover:border-[#034D28]/60' : 'border-gray-200 opacity-60 bg-gray-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h3 className="font-extrabold text-sm text-gray-900 leading-tight">
                    {veg.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(veg)}
                    title={veg.isActive ? 'Deactivate' : 'Activate'}
                    className="p-0.5"
                  >
                    {veg.isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {veg.tamilName && (
                  <p className="text-xs font-tamil font-bold text-[#034D28] mb-2">
                    {veg.tamilName}
                  </p>
                )}

                <div className="flex items-baseline justify-between text-xs mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-500 font-medium">Rate / {veg.unit || 'Kg'}:</span>
                  <span className="font-mono-num font-black text-gray-950 text-sm">
                    {veg.defaultRate > 0 ? `₹${veg.defaultRate}` : 'Market'}
                  </span>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1 font-mono-num">
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                  {veg.usageCount || 0} bills
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(veg)}
                    className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(veg)}
                    className="p-1 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-[#034D28] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingVeg ? 'Edit Vegetable' : 'Add New Vegetable'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  English Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Cauliflower, Drumstick..."
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
                  placeholder="e.g. காலிஃபிளவர், முருங்கைக்காய்..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-tamil font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Default Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.defaultRate}
                    onChange={(e) => setFormData({ ...formData, defaultRate: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-mono-num font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] outline-none font-semibold bg-white"
                  >
                    <option value="Kg">Kg</option>
                    <option value="Bag">Bag (மூட்டை)</option>
                    <option value="Box">Box (பெட்டி)</option>
                    <option value="Piece">Piece (எண்ணிக்கை)</option>
                    <option value="Bunch">Bunch (கட்டு)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#034D28] text-white font-bold rounded-xl hover:bg-[#02361c] shadow-md"
                >
                  Save Vegetable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vegetables;
