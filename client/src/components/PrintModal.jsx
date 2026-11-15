import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';
import appCache from '../services/cache';
import BillPrintTemplate from './BillPrintTemplate';
import LegacyBillPrintTemplate from './LegacyBillPrintTemplate';

/**
 * PrintModal component:
 * 1. Mounts via React Portal into #print-root (outside #root).
 * 2. Adds 'print-bill-active' to document.body and injects A6 @page rule.
 * 3. Enforces A6 sheet layout (105mm × 148mm) and guarantees ONLY the bill prints on 1 sheet.
 */
export const PrintModal = ({
  isOpen,
  onClose,
  bill,
  settings,
  autoPrint = false,
}) => {
  const [printMountNode, setPrintMountNode] = useState(null);
  const [scale, setScale] = useState(1);
  const [masterVegetables, setMasterVegetables] = useState([]);
  const scrollAreaRef = useRef(null);

  // Load master vegetables for resolving Tamil names in printed bills (with in-memory cache)
  useEffect(() => {
    let isMounted = true;
    const cachedVegs = appCache.get('vegetables_active') || appCache.get('vegetables_all');
    if (cachedVegs && cachedVegs.length > 0) {
      setMasterVegetables(cachedVegs);
      return;
    }

    api.get('/vegetables?activeOnly=all&limit=500')
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setMasterVegetables(res.data);
          appCache.set('vegetables_all', res.data, 5 * 60 * 1000);
        }
      })
      .catch((err) => console.warn('Could not load vegetables for print modal:', err));
    return () => { isMounted = false; };
  }, []);

  // Locate #print-root mount target
  useEffect(() => {
    let node = document.getElementById('print-root');
    if (!node) {
      node = document.createElement('div');
      node.id = 'print-root';
      document.body.appendChild(node);
    }
    setPrintMountNode(node);
  }, []);

  // Manage body class 'print-bill-active' and dynamic A6 @page style when modal is open
  useEffect(() => {
    if (isOpen && bill) {
      document.body.classList.add('print-bill-active');
      let styleTag = document.getElementById('a6-bill-print-style');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'a6-bill-print-style';
        styleTag.textContent = '@page { size: 105mm 148mm; margin: 0; }';
        document.head.appendChild(styleTag);
      }
    } else {
      document.body.classList.remove('print-bill-active');
      const styleTag = document.getElementById('a6-bill-print-style');
      if (styleTag) styleTag.remove();
    }
    return () => {
      document.body.classList.remove('print-bill-active');
      const styleTag = document.getElementById('a6-bill-print-style');
      if (styleTag) styleTag.remove();
    };
  }, [isOpen, bill]);

  // Handle autoPrint trigger if requested
  useEffect(() => {
    if (isOpen && bill && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, bill, autoPrint]);

  // Auto-scale preview on narrow screen viewports (mobile / tablets)
  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (!scrollAreaRef.current) return;
      const clientWidth = scrollAreaRef.current.clientWidth;
      const baseWidthPx = 397; // 105mm in 96 DPI CSS pixels (105 / 25.4 * 96)
      const availableWidth = clientWidth - 24;
      if (availableWidth > 0 && availableWidth < baseWidthPx) {
        setScale(availableWidth / baseWidthPx);
      } else {
        setScale(1);
      }
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [isOpen]);

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !bill || !printMountNode) return null;

  const modalContent = (
    <div className="print-modal-portal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="print-modal-container bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[96vh] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header Controls (Hidden during print) */}
        <div className="no-print p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-[#034D28]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-gray-900 leading-tight">
                  Bill #{bill.billNumberFormatted || 'Preview'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#034D28] border border-emerald-300 rounded-full text-[11px] font-black">
                  <CheckCircle2 className="w-3 h-3 text-[#034D28]" />
                  A6 Sheet (1 Sheet Only)
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Target: Canon G3030 series • Alignment matched to A6 portrait (105 × 148 mm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#034D28] hover:bg-[#02381c] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area & Screen Preview */}
        <div
          ref={scrollAreaRef}
          className="print-modal-scroll-area flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-200/60 flex justify-center items-start"
        >
          <div
            className="print-bill-scaler"
            style={{
              transform: scale < 1 ? `scale(${scale})` : 'none',
              transformOrigin: 'top center',
            }}
          >
            {bill.billVersion === 'v1_legacy_6col' ? (
              <LegacyBillPrintTemplate bill={bill} settings={settings} masterVegetables={masterVegetables} />
            ) : (
              <BillPrintTemplate bill={bill} settings={settings} masterVegetables={masterVegetables} />
            )}
          </div>
        </div>

        {/* Modal Footer Controls (Hidden during print) */}
        <div className="no-print px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-white">
          <span>
            Press <strong>Ctrl + P</strong> or click <strong>Print Bill</strong> to print directly to Canon G3030 series.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, printMountNode);
};

export default PrintModal;
