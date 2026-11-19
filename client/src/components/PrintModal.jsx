import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ImageDown,
  Share2,
} from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import api from '../api/axios';
import appCache from '../services/cache';
import BillPrintTemplate from './BillPrintTemplate';
import LegacyBillPrintTemplate from './LegacyBillPrintTemplate';

/**
 * PrintModal component:
 * 1. Mounts via React Portal into #print-root (outside #root).
 * 2. Adds 'print-bill-active' to document.body and injects A5 @page rule.
 * 3. Enforces A5 sheet layout (148mm × 210mm) and guarantees ONLY the bill prints.
 * 4. Provides a unified print menu:
 *    - Direct to Canon G3030 (1-click direct USB printing)
 *    - Download All Bill Images (PNG at 3x scale)
 *    - Share All Bill Images (Multi-file native share / WhatsApp)
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const scrollAreaRef = useRef(null);
  const dropdownRef = useRef(null);

  const isSupplierBill = Boolean(
    bill?.isPurchase ||
    bill?.purchaseNumber ||
    bill?.purchaseNumberFormatted ||
    bill?.supplierName ||
    bill?.supplier ||
    bill?.billType === 'purchase'
  );

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

  // Manage body class 'print-bill-active' and dynamic A5 @page style when modal is open
  useEffect(() => {
    if (isOpen && bill) {
      document.body.classList.add('print-bill-active');
      let styleTag = document.getElementById('a5-bill-print-style');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'a5-bill-print-style';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = '@page { size: 148mm 210mm; margin: 0; } @media print { html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; } }';
    } else {
      document.body.classList.remove('print-bill-active');
      const styleTag = document.getElementById('a5-bill-print-style');
      if (styleTag) styleTag.remove();
    }
    return () => {
      document.body.classList.remove('print-bill-active');
      const styleTag = document.getElementById('a5-bill-print-style');
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
      const baseWidthPx = 560; // 148mm in 96 DPI CSS pixels (148 / 25.4 * 96)
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

  // Close options dropdown on outside click
  useEffect(() => {
    if (!showOptions) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptions]);

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showOptions) {
          setShowOptions(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showOptions, onClose]);

  // 1. Direct Print to Canon G3030 (A5 Portrait)
  const handleDirectPrint = () => {
    setShowOptions(false);
    setIsPrinting(true);
    setPrintMessage('Sending to Canon G3030...');

    const origTitle = document.title;
    const billNum = bill?.billNumberFormatted || (bill?.billNumber ? `CPN-${String(bill.billNumber).padStart(4, '0')}` : 'Bill');
    document.title = billNum;

    try {
      window.print();
      setPrintSuccess(true);
      setPrintMessage('Printed to Canon G3030');
      setTimeout(() => {
        setPrintSuccess(false);
        setPrintMessage('');
      }, 4000);
    } catch (err) {
      console.warn('[PrintModal] Direct print error:', err);
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        document.title = origTitle;
      }, 2000);
    }
  };

  // Helper to render all bill pages (Page 1, Page 2, etc.) as high-resolution PNG blobs and Files
  const renderAllBillPages = async () => {
    // Locate the printable bill container
    const printableOuter = document.querySelector('#printable-bill');
    let pageNodes = printableOuter ? Array.from(printableOuter.querySelectorAll('.cpn-a5-bill')) : [];
    if (pageNodes.length === 0) {
      const singleNode = document.querySelector('.cpn-a5-bill');
      if (singleNode) pageNodes = [singleNode];
    }

    if (pageNodes.length === 0) {
      throw new Error('Bill content element not found');
    }

    // Exact unscaled A5 dimensions in screen pixels (96 DPI: 1 inch = 25.4mm)
    // A5 width: 148mm = 559.37px; A5 height: 210mm = 793.70px
    const targetWidthPx = 559.37;
    const targetHeightPx = 793.70;

    // Wait for Tamil fonts (Mukta Malar / Noto Sans Tamil / system) to be ready
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const billNum =
      bill?.billNumberFormatted ||
      bill?.purchaseNumberFormatted ||
      (bill?.billNumber ? `CPN-${String(bill.billNumber).padStart(4, '0')}` : 'BILL');

    const totalPages = pageNodes.length;
    const renderedPages = [];

    // Process each page sequentially
    for (let i = 0; i < totalPages; i++) {
      const pageNode = pageNodes[i];
      // Numbered files for multi-page bills (e.g. CPN-0091-Page-1.png, CPN-0091-Page-2.png)
      const filename = totalPages > 1 ? `${billNum}-Page-${i + 1}.png` : `${billNum}.png`;

      let exportContainer = null;
      try {
        // Dedicated unscaled off-screen container to isolate from modal zoom/scale
        exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-99999px';
        exportContainer.style.top = '0';
        exportContainer.style.width = `${targetWidthPx}px`;
        exportContainer.style.height = `${targetHeightPx}px`;
        exportContainer.style.margin = '0';
        exportContainer.style.padding = '0';
        exportContainer.style.overflow = 'hidden';
        exportContainer.style.background = '#ffffff';
        exportContainer.style.zIndex = '-9999';
        exportContainer.style.transform = 'none';

        const clone = pageNode.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.margin = '0';
        clone.style.width = `${targetWidthPx}px`;
        clone.style.height = `${targetHeightPx}px`;
        clone.style.maxWidth = `${targetWidthPx}px`;
        clone.style.maxHeight = `${targetHeightPx}px`;
        clone.style.boxShadow = 'none';
        clone.style.border = 'none';
        clone.style.borderRadius = '0';

        exportContainer.appendChild(clone);
        document.body.appendChild(exportContainer);

        // Ensure template background image and logos are loaded in the clone
        const imgElements = Array.from(clone.querySelectorAll('img'));
        await Promise.all(
          imgElements.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 500);
            });
          })
        );

        // Layout stabilization tick
        await new Promise((r) => setTimeout(r, 60));

        // Generate high-resolution (3x) PNG blob
        let blob = null;
        try {
          blob = await toBlob(clone, {
            pixelRatio: 3,
            width: targetWidthPx,
            height: targetHeightPx,
            backgroundColor: '#ffffff',
            cacheBust: false,
          });
        } catch (blobErr) {
          console.warn('[PrintModal] toBlob direct capture fallback to toPng:', blobErr);
          const dataUrl = await toPng(clone, {
            pixelRatio: 3,
            width: targetWidthPx,
            height: targetHeightPx,
            backgroundColor: '#ffffff',
          });
          const resp = await fetch(dataUrl);
          blob = await resp.blob();
        }

        if (!blob) {
          throw new Error(`Page ${i + 1} image generation produced empty blob`);
        }

        const file = new File([blob], filename, { type: 'image/png' });
        renderedPages.push({
          pageNumber: i + 1,
          totalPages,
          filename,
          blob,
          file,
        });
      } finally {
        if (exportContainer && exportContainer.parentNode) {
          exportContainer.parentNode.removeChild(exportContainer);
        }
      }
    }

    return renderedPages;
  };

  // 2. Download All Bill Pages (PNG) - downloads all pages sequentially
  const handleDownloadAllImages = async () => {
    setShowOptions(false);
    setIsDownloadingImage(true);
    setPrintMessage('Exporting bill images...');

    try {
      const renderedPages = await renderAllBillPages();

      for (let i = 0; i < renderedPages.length; i++) {
        const page = renderedPages[i];
        const url = window.URL.createObjectURL(page.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = page.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);

        // Space downloads when multiple pages to avoid browser popup blockers
        if (renderedPages.length > 1 && i < renderedPages.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      const successMsg =
        renderedPages.length > 1
          ? `All ${renderedPages.length} bill images downloaded!`
          : 'Bill image downloaded!';
      setPrintMessage(successMsg);
      setTimeout(() => setPrintMessage(''), 4000);
    } catch (err) {
      console.error('[PrintModal] Download bill images failed:', err);
      setPrintMessage('Failed to download bill images');
      setTimeout(() => setPrintMessage(''), 4000);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Alias for backward compatibility
  const handleDownloadImage = handleDownloadAllImages;

  // 3. Share All Bill Pages - Native Web Share API with all files attached (e.g. WhatsApp)
  const handleShareAllImages = async () => {
    setShowOptions(false);
    setIsSharing(true);
    setPrintMessage('Preparing bill images for sharing...');

    try {
      const renderedPages = await renderAllBillPages();
      const allFiles = renderedPages.map((p) => p.file);
      const billNum =
        bill?.billNumberFormatted ||
        bill?.purchaseNumberFormatted ||
        (bill?.billNumber ? `CPN-${String(bill.billNumber).padStart(4, '0')}` : 'BILL');

      // Check whether native sharing with multiple files is supported
      const canShareAll =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: allFiles });

      let shareSuccess = false;

      if (canShareAll) {
        try {
          await navigator.share({
            files: allFiles,
            title: `CPN Vegetables Bill #${billNum}`,
            text: `CPN Vegetables Bill #${billNum}`,
          });
          shareSuccess = true;
          setPrintMessage(
            renderedPages.length > 1
              ? `All ${renderedPages.length} bill pages shared!`
              : 'Bill image shared!'
          );
          setTimeout(() => setPrintMessage(''), 4000);
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') {
            // User dismissed or canceled share dialog
            setPrintMessage('');
            return;
          }
          console.warn('[PrintModal] Native share failed, falling back to download:', shareErr);
        }
      }

      // If native sharing is unsupported or failed, download all pages individually with guidance
      if (!shareSuccess) {
        for (let i = 0; i < renderedPages.length; i++) {
          const page = renderedPages[i];
          const url = window.URL.createObjectURL(page.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = page.filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => window.URL.revokeObjectURL(url), 2000);

          if (renderedPages.length > 1 && i < renderedPages.length - 1) {
            await new Promise((r) => setTimeout(r, 400));
          }
        }

        const fallbackMsg =
          renderedPages.length > 1
            ? `All ${renderedPages.length} bill pages downloaded. You can attach them together in WhatsApp.`
            : 'Bill image downloaded. You can attach it in WhatsApp.';
        setPrintMessage(fallbackMsg);
        setTimeout(() => setPrintMessage(''), 5000);
      }
    } catch (err) {
      console.error('[PrintModal] Share bill images failed:', err);
      setPrintMessage('Failed to share bill images');
      setTimeout(() => setPrintMessage(''), 4000);
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen || !bill || !printMountNode) return null;

  const rawItems = bill?.items || [];
  const activeItems = rawItems.filter(
    (it) => it.particulars?.trim() || Number(it.amount) > 0 || Number(it.rate) > 0
  );
  const itemCount = activeItems.length || 1;
  const sheetCount = Math.max(1, Math.ceil(itemCount / 10));

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
                  Bill #{bill.billNumberFormatted || bill.purchaseNumberFormatted || 'Preview'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#034D28] border border-emerald-300 rounded-full text-[11px] font-black">
                  <CheckCircle2 className="w-3 h-3 text-[#034D28]" />
                  {sheetCount === 1 ? 'A5 Sheet (1 Sheet Only)' : `A5 Sheets (${sheetCount} Sheets)`}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Target: Canon G3030 series • Alignment matched to A5 portrait (148 × 210 mm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Status Feedback Message */}
            {printMessage && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#034D28] border border-emerald-200 rounded-xl text-xs font-bold animate-in fade-in">
                {(isDownloadingImage || isSharing) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                )}
                {printSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {printMessage}
              </span>
            )}

            {/* Print & Export Action Menu (Split Button) */}
            <div className="relative inline-flex items-stretch shadow-md rounded-xl">
              <button
                type="button"
                onClick={() => handleDirectPrint()}
                disabled={isDownloadingImage || isSharing}
                className={`px-3.5 sm:px-4 py-2 bg-[#034D28] hover:bg-[#02381c] text-white text-xs sm:text-sm font-bold rounded-l-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  isDownloadingImage || isSharing ? 'opacity-85' : ''
                }`}
                title="Direct Print to Canon G3030"
              >
                {isDownloadingImage || isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : printSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>
                  {isDownloadingImage
                    ? 'Exporting...'
                    : isSharing
                    ? 'Sharing...'
                    : printSuccess
                    ? 'Printed!'
                    : 'Print Bill'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="px-2 sm:px-2.5 bg-[#02381c] hover:bg-[#012513] text-white rounded-r-xl border-l border-emerald-700/50 flex items-center justify-center cursor-pointer transition-colors"
                title="More Print & Download Options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Options Dropdown Menu */}
              {showOptions && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 1. Direct to Canon G3030 */}
                  <button
                    type="button"
                    onClick={() => handleDirectPrint()}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Printer className="w-4 h-4 text-[#034D28]" />
                    <div>
                      <div className="font-extrabold text-gray-900">Direct to Canon G3030</div>
                      <div className="text-[10px] text-gray-400 font-normal">1-click direct USB printing (A5)</div>
                    </div>
                  </button>

                  {/* 2. Download All Bill Images */}
                  <button
                    type="button"
                    onClick={handleDownloadAllImages}
                    disabled={isDownloadingImage || isSharing}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isDownloadingImage ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    ) : (
                      <ImageDown className="w-4 h-4 text-blue-600" />
                    )}
                    <div>
                      <div className="font-extrabold text-gray-900">
                        {sheetCount > 1 ? 'Download All Bill Images (PNG)' : 'Download Bill Image (PNG)'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-normal">
                        {isDownloadingImage
                          ? 'Generating PNGs...'
                          : sheetCount > 1
                          ? `Save all ${sheetCount} pages as high-resolution PNG`
                          : 'High-resolution PNG (A5)'}
                      </div>
                    </div>
                  </button>

                  {/* 3. Share All Bill Images */}
                  <button
                    type="button"
                    onClick={handleShareAllImages}
                    disabled={isDownloadingImage || isSharing}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isSharing ? (
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <div>
                      <div className="font-extrabold text-gray-900">
                        {sheetCount > 1 ? 'Share All Bill Images' : 'Share Bill Image'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-normal">
                        {isSharing
                          ? 'Preparing share...'
                          : sheetCount > 1
                          ? `Share all ${sheetCount} pages via WhatsApp / apps`
                          : 'Share via WhatsApp / apps'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

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
            Press <strong>Ctrl + P</strong> to print, or use the menu to <strong>Download / Share bill images</strong>.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
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
