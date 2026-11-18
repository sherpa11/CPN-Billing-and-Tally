import React, { useState, useRef, useEffect } from 'react';
import { Truck, Phone, Plus, Check } from 'lucide-react';
import { formatCurrency } from '../utils/math';

export const SupplierAutocomplete = ({
  selectedSupplier = null,
  suppliers = [],
  onSelectSupplier,
  onTextChange,
  inputRef,
  onEnterNext,
}) => {
  const [searchTerm, setSearchTerm] = useState(selectedSupplier?.name || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    if (selectedSupplier) {
      setSearchTerm(selectedSupplier.name);
    } else if (selectedSupplier === null && searchTerm && !onTextChange) {
      setSearchTerm('');
    }
  }, [selectedSupplier]);

  const filtered = suppliers.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      s.tamilName?.toLowerCase().includes(term)
    );
  });

  const hasExact = suppliers.some(
    (s) => s.name?.toLowerCase().trim() === searchTerm.toLowerCase().trim()
  );

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (supplier) => {
    setSearchTerm(supplier.name);
    setIsOpen(false);
    if (onTextChange) onTextChange(supplier.name);
    if (onSelectSupplier) onSelectSupplier(supplier);
    if (onEnterNext) onEnterNext();
  };

  const handleCreateInstant = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    const newSupp = {
      name: trimmed,
      currentBalance: 0,
      isNew: true,
    };
    if (onTextChange) onTextChange(trimmed);
    if (onSelectSupplier) onSelectSupplier(newSupp);
    setIsOpen(false);
    if (onEnterNext) onEnterNext();
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    setIsOpen(true);
    setHighlightedIndex(0);
    if (onTextChange) onTextChange(newVal);
  };

  const handleBlur = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      if (onTextChange) onTextChange('');
      return;
    }

    const matchedSupp = suppliers.find(
      (s) =>
        s.name?.toLowerCase().trim() === trimmed.toLowerCase() ||
        s.phone?.trim() === trimmed ||
        s.tamilName?.trim() === trimmed
    );

    if (matchedSupp) {
      handleSelect(matchedSupp);
    } else {
      if (onTextChange) onTextChange(trimmed);
      if (onSelectSupplier) {
        onSelectSupplier({ name: trimmed, currentBalance: 0, isNew: true });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleBlur();
        if (onEnterNext) onEnterNext();
      }
      return;
    }

    const totalOptions = filtered.length + (!hasExact && searchTerm.trim() ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalOptions));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions) % Math.max(1, totalOptions));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex]);
      } else if (!hasExact && searchTerm.trim()) {
        handleCreateInstant();
      } else {
        handleBlur();
        if (onEnterNext) onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none">
          <Truck className="w-4 h-4 text-emerald-800" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(handleBlur, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search supplier name or mobile..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] text-sm font-bold text-gray-900 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal bg-white"
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {filtered.length === 0 && !searchTerm.trim() ? (
            <div className="p-3 text-xs text-gray-400 text-center">
              Type to search suppliers...
            </div>
          ) : (
            <>
              {filtered.map((supplier, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isSelected = selectedSupplier?._id === supplier._id;

                return (
                  <button
                    key={supplier._id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(supplier);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-emerald-50 text-[#034D28]' : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#034D28] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="truncate">{supplier.name}</span>
                          {supplier.tamilName && (
                            <span className="text-[11px] text-gray-500 font-tamil font-normal">
                              ({supplier.tamilName})
                            </span>
                          )}
                        </div>
                        {supplier.phone && (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 font-mono-num">
                            <Phone className="w-2.5 h-2.5" />
                            {supplier.phone}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-[11px] font-bold font-mono-num text-amber-800">
                        ₹{formatCurrency(supplier.currentBalance || 0)}
                      </div>
                      <div className="text-[9px] text-gray-400">Balance</div>
                    </div>
                  </button>
                );
              })}

              {!hasExact && searchTerm.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCreateInstant();
                  }}
                  onMouseEnter={() => setHighlightedIndex(filtered.length)}
                  className={`w-full text-left px-3 py-2 border-t border-gray-100 flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                    highlightedIndex === filtered.length
                      ? 'bg-emerald-100 text-[#034D28]'
                      : 'bg-emerald-50/50 text-[#034D28] hover:bg-emerald-50'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Add new supplier: "<strong>{searchTerm.trim()}</strong>"
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierAutocomplete;
