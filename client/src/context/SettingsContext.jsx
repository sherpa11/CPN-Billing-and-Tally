import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const defaultSettings = {
  shopName: 'CPN VEGETABLES',
  tamilHeaderInvocation: 'உ',
  tamilHeaderDeity: 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை',
  tamilBusinessDescription: 'இங்கிலீஷ் காய்கனி கமிஷன் மண்டி',
  address: '22-A, காந்தி மார்க்கெட், திண்டுக்கல்.',
  contactNumbers: ['97152 67025', '97882 29090'],
  footerText: 'வாழ்க வளமுடன்',
  primaryColor: '#034D28',
  secondaryColor: '#FFFFFF',
  billPrefix: 'CPN',
  paperSize: 'A4',
  logoUrl: '/cpn_logo.png',
};

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.success && res.data) {
        setSettings({ ...defaultSettings, ...res.data });
      }
    } catch (err) {
      console.warn('[Settings] Failed to fetch settings, using defaults:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings) => {
    const res = await api.put('/settings', newSettings);
    if (res.success && res.data) {
      setSettings(res.data);
      return res.data;
    }
    throw new Error(res.message || 'Failed to update settings');
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
