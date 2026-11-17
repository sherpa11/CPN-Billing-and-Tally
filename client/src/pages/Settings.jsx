import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Printer,
} from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';

export const Settings = () => {
  const { settings, refreshSettings, updateSettings } = useSettings();

  const [formData, setFormData] = useState({
    shopName: '',
    tamilHeaderInvocation: 'உ',
    tamilHeaderDeity: '',
    tamilBusinessDescription: '',
    address: '',
    contactNumbers: '',
    footerText: '',
    billPrefix: 'CPN',
    paperSize: 'A5',
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Backup & Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');

  useEffect(() => {
    if (settings) {
      setFormData({
        shopName: settings.shopName || 'CPN VEGETABLES',
        tamilHeaderInvocation: settings.tamilHeaderInvocation || 'உ',
        tamilHeaderDeity: settings.tamilHeaderDeity || 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை',
        tamilBusinessDescription: settings.tamilBusinessDescription || 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி',
        address: settings.address || '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.',
        contactNumbers: (settings.contactNumbers || ['97152 67025', '97882 29090']).join(', '),
        footerText: settings.footerText || 'வாழ்க வளமுடன்',
        billPrefix: settings.billPrefix || 'CPN',
        paperSize: settings.paperSize || 'A5',
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        ...formData,
        contactNumbers: formData.contactNumbers.split(',').map((s) => s.trim()).filter(Boolean),
      };

      await updateSettings(payload);
      setSuccessMsg('Shop settings updated successfully!');
      refreshSettings();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setBackupLoading(true);
      const res = await api.get('/backup/export');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CPN_Vegetables_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Backup export failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restore database from this backup? Existing records will be synced.')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoreStatus('Restoring database...');
        const json = JSON.parse(event.target.result);
        const res = await api.post('/backup/restore', json);
        if (res.success) {
          setRestoreStatus(`Restored: ${res.restored.bills} bills, ${res.restored.customers} customers, ${res.restored.vegetables} vegetables`);
          refreshSettings();
        }
      } catch (err) {
        setRestoreStatus(`Restore error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            Shop Settings & System Config / அமைப்புகள்
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            Manage CPN VEGETABLES shop details, Tamil print titles, and database disaster recovery
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#034D28]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-sm font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-extrabold text-gray-900 border-b pb-2 flex items-center gap-2">
          <Printer className="w-4 h-4 text-[#034D28]" />
          <span>Shop & Printed Bill Identity</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Shop Name (English)
            </label>
            <input
              type="text"
              required
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-bold focus:border-[#034D28] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Invocation (உ)
            </label>
            <input
              type="text"
              value={formData.tamilHeaderInvocation}
              onChange={(e) => setFormData({ ...formData, tamilHeaderInvocation: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-bold focus:border-[#034D28] outline-none text-sm text-center"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Tamil Header Deity (கடவுள் வாழ்த்து)
          </label>
          <input
            type="text"
            value={formData.tamilHeaderDeity}
            onChange={(e) => setFormData({ ...formData, tamilHeaderDeity: e.target.value })}
            className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-tamil font-bold focus:border-[#034D28] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Tamil Business Description (காய்கறி மண்டி விபரம்)
          </label>
          <input
            type="text"
            value={formData.tamilBusinessDescription}
            onChange={(e) => setFormData({ ...formData, tamilBusinessDescription: e.target.value })}
            className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-tamil font-bold focus:border-[#034D28] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Shop Address (முகவரி)
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-tamil font-semibold focus:border-[#034D28] outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Contact Numbers (Comma separated)
            </label>
            <input
              type="text"
              value={formData.contactNumbers}
              onChange={(e) => setFormData({ ...formData, contactNumbers: e.target.value })}
              placeholder="97152 67025, 97882 29090"
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-mono-num font-bold focus:border-[#034D28] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Footer Text (வாழ்த்து)
            </label>
            <input
              type="text"
              value={formData.footerText}
              onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-tamil font-bold focus:border-[#034D28] outline-none text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Bill Number Prefix
            </label>
            <input
              type="text"
              value={formData.billPrefix}
              onChange={(e) => setFormData({ ...formData, billPrefix: e.target.value.toUpperCase() })}
              placeholder="CPN"
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-mono-num font-bold focus:border-[#034D28] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Printing Paper Size
            </label>
            <select
              value={formData.paperSize}
              onChange={(e) => setFormData({ ...formData, paperSize: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2.5 border border-gray-300 rounded-xl font-bold focus:border-[#034D28] outline-none text-sm bg-white"
            >
              <option value="A5">A5 (Standard Wholesale Bill - 148 × 210 mm)</option>
              <option value="A4">A4 (Full Sheet)</option>
              <option value="Thermal">Thermal 80mm</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#034D28] hover:bg-[#02361c] text-white rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Database Backup & Disaster Recovery Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-extrabold text-gray-900 border-b pb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#034D28]" />
          <span>Long-term Data Safety & Backup Recovery</span>
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Download an encrypted JSON snapshot of all bills, customers, master vegetables, payments, and accounting transactions. You can restore your complete database anytime on any device.
        </p>

        {restoreStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl">
            {restoreStatus}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={backupLoading}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#034D28] font-bold text-xs rounded-xl flex items-center gap-2 border border-emerald-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{backupLoading ? 'Exporting...' : 'Export Full Database Backup'}</span>
          </button>

          <label className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors border border-gray-300">
            <Upload className="w-4 h-4" />
            <span>Restore From Backup JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
