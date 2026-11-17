import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import BillPrintTemplate from '../components/BillPrintTemplate';

const mockVegetablesList = [
  { tamilName: 'தக்காளி', name: 'Tomato', rate: 45, bag: 2, weight: 52.5, amount: 2362.5 },
  { tamilName: 'வெங்காயம்', name: 'Onion', rate: 38, bag: 3, weight: 75.0, amount: 2850.0 },
  { tamilName: 'உருளைக்கிழங்கு', name: 'Potato', rate: 32, bag: 2, weight: 60.0, amount: 1920.0 },
  { tamilName: 'கேரட்', name: 'Carrot', rate: 55, bag: 1, weight: 28.5, amount: 1567.5 },
  { tamilName: 'பீன்ஸ்', name: 'Beans', rate: 65, bag: 1, weight: 22.0, amount: 1430.0 },
  { tamilName: 'முட்டைக்கோஸ்', name: 'Cabbage', rate: 25, bag: 2, weight: 48.0, amount: 1200.0 },
  { tamilName: 'காலிஃபிளவர்', name: 'Cauliflower', rate: 40, bag: 1, weight: 20.0, amount: 800.0 },
  { tamilName: 'பீட்ரூட்', name: 'Beetroot', rate: 35, bag: 1, weight: 30.0, amount: 1050.0 },
  { tamilName: 'கத்தரிக்காய்', name: 'Brinjal', rate: 42, bag: 1, weight: 25.0, amount: 1050.0 },
  { tamilName: 'வெண்டைக்காய்', name: 'Ladies Finger', rate: 48, bag: 1, weight: 20.0, amount: 960.0 },
  { tamilName: 'முருங்கைக்காய்', name: 'Drumstick', rate: 80, bag: 1, weight: 15.0, amount: 1200.0 },
  { tamilName: 'சுரைக்காய்', name: 'Bottle Gourd', rate: 22, bag: 2, weight: 35.0, amount: 770.0 },
  { tamilName: 'பாகற்காய்', name: 'Bitter Gourd', rate: 50, bag: 1, weight: 18.0, amount: 900.0 },
  { tamilName: 'புடலங்காய்', name: 'Snake Gourd', rate: 28, bag: 1, weight: 24.0, amount: 672.0 },
  { tamilName: 'பீர்க்கங்காய்', name: 'Ridge Gourd', rate: 45, bag: 1, weight: 19.5, amount: 877.5 },
  { tamilName: 'இஞ்சி', name: 'Ginger', rate: 120, bag: 1, weight: 12.0, amount: 1440.0 },
  { tamilName: 'பூண்டு', name: 'Garlic', rate: 180, bag: 1, weight: 10.0, amount: 1800.0 },
  { tamilName: 'பச்சை மிளகாய்', name: 'Green Chilli', rate: 60, bag: 1, weight: 15.0, amount: 900.0 },
  { tamilName: 'கொத்தமல்லி', name: 'Coriander', rate: 30, bag: 2, weight: 20.0, amount: 600.0 },
  { tamilName: 'புதினா', name: 'Mint', rate: 25, bag: 2, weight: 18.0, amount: 450.0 },
  { tamilName: 'சௌசௌ', name: 'Chow Chow', rate: 26, bag: 1, weight: 22.0, amount: 572.0 },
  { tamilName: 'நூல்கோல்', name: 'Knol Khol', rate: 34, bag: 1, weight: 20.0, amount: 680.0 },
];

export const TestPrintPage = () => {
  const [searchParams] = useSearchParams();
  const countParam = parseInt(searchParams.get('items') || '5', 10);
  const itemCount = Math.max(1, countParam);

  const items = Array.from({ length: itemCount }, (_, idx) => {
    const base = mockVegetablesList[idx % mockVegetablesList.length];
    return {
      ...base,
      tamilName: idx >= mockVegetablesList.length ? `${base.tamilName} ${idx + 1}` : base.tamilName,
      particulars: idx >= mockVegetablesList.length ? `${base.name} ${idx + 1}` : base.name,
      amount: Math.round((base.rate * base.weight) * 100) / 100,
    };
  });
  const todayTotal = items.reduce((sum, it) => sum + it.amount, 0);
  const prevBalance = 2500;
  const total = todayTotal + prevBalance;
  const discount = Number(searchParams.get('discount') || 0);
  const varavu = 5000;
  const closingBalance = total - discount - varavu;

  const mockBill = {
    billNumberFormatted: `CPN-${String(1000 + itemCount)}`,
    billDate: new Date('2026-11-14'),
    customerName: 'கார்த்திக் ஹோட்டல் & கேன்டீன் (திண்டுக்கல்)',
    customerPhone: '97901 98765',
    items,
    todayTotal,
    previousBalance: prevBalance,
    previousBalanceDate: new Date('2026-11-10'),
    grandTotal: total,
    discount,
    varavu,
    cashReceived: varavu,
    closingBalance,
    billVersion: 'v3_new_6row',
  };

  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    document.body.classList.add('print-bill-active');
    let styleTag = document.getElementById('a6-bill-print-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'a6-bill-print-style';
      styleTag.textContent = '@page { size: 105mm 148mm; margin: 0; }';
      document.head.appendChild(styleTag);
    }
    let node = document.getElementById('print-root');
    if (!node) {
      node = document.createElement('div');
      node.id = 'print-root';
      document.body.appendChild(node);
    }
    setMountNode(node);

    return () => {
      document.body.classList.remove('print-bill-active');
      const st = document.getElementById('a6-bill-print-style');
      if (st) st.remove();
    };
  }, []);

  if (!mountNode) return null;

  return createPortal(
    <div style={{ background: '#ffffff', margin: 0, padding: 0 }}>
      <BillPrintTemplate bill={mockBill} />
    </div>,
    mountNode
  );
};

export default TestPrintPage;
