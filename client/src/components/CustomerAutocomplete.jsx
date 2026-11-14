import React, { useState, useRef, useEffect } from 'react';
import { User, Phone, Plus, Check } from 'lucide-react';
import { formatCurrency } from '../utils/math';

export const CustomerAutocomplete = ({
  selectedCustomer = null,
  customers = [],
  onSelectCustomer,
  onTextChange,
  inputRef,
  onEnterNext,
}) => {
  const [searchTerm, setSearchTerm] = useState(selectedCustomer?.name || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    if (selectedCustomer) {
      setSearchTerm(selectedCustomer.name);
    }
  }, [selectedCustomer]);

  const filtered = customers.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.tamilName?.toLowerCase().includes(term)
    );
  });

  const hasExact = customers.some(
    (c) => c.name?.toLowerCase().trim() === searchTerm.toLowerCase().trim()
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

  const handleSelect = (customer) => {
    setSearchTerm(customer.name);
    setIsOpen(false);
    if (onTextChange) onTextChange(customer.name);
    if (onSelectCustomer) onSelectCustomer(customer);
    if (onEnterNext) onEnterNext();
  };

  const handleCreateInstant = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    const newCust = {
      name: trimmed,
      currentBalance: 0,
      isNew: true,
    };
    if (onTextChange) onTextChange(trimmed);
    if (onSelectCustomer) onSelectCustomer(newCust);
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

    const matchedCust = customers.find(
      (c) =>
        c.name?.toLowerCase().trim() === trimmed.toLowerCase() ||
        c.phone?.trim() === trimmed ||
        c.tamilName?.trim() === trimmed
    );

    if (matchedCust) {
      handleSelect(matchedCust);
    } else {
      if (onTextChange) onTextChange(trimmed);
      if (onSelectCustomer) {
        onSelectCustomer({ name: trimmed, currentBalance: 0, isNew: true });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const total = filtered.length + (!hasExact && searchTerm.trim() ? 1 : 0);
        setHighlightedIndex((prev) => (prev + 1) % total);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const total = filtered.length + (!hasExact && searchTerm.trim() ? 1 : 0);
        setHighlightedIndex((prev) => (prev - 1 + total) % total);
      }
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex]);
        } else if (!hasExact && searchTerm.trim()) {
          handleCreateInstant();
        } else {
          setIsOpen(false);
          if (onEnterNext) onEnterNext();
        }
      } else if (onEnterNext) {
        e.preventDefault();
        onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search customer by name or mobile..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-2 focus:ring-[#034D28]/20 font-semibold text-gray-900 text-sm outline-none"
          autoComplete="off"
        />
        <User className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border-2 border-[#034D28] rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((cust, index) => (
              <div
                key={cust._id || index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(cust);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between text-sm transition-colors border-b border-gray-100 last:border-0 ${
                  highlightedIndex === index
                    ? 'bg-[#034D28] text-white'
                    : 'text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{cust.name}</span>
                    {cust.tamilName && (
                      <span
                        className={`text-xs font-tamil ${
                          highlightedIndex === index ? 'text-emerald-200' : 'text-emerald-700'
                        }`}
                      >
                        ({cust.tamilName})
                      </span>
                    )}
                  </div>
                  {cust.phone && (
                    <div
                      className={`text-xs flex items-center gap-1 font-mono-num ${
                        highlightedIndex === index ? 'text-emerald-100' : 'text-gray-500'
                      }`}
                    >
                      <Phone className="w-3 h-3" />
                      {cust.phone}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-bold font-mono-num ${
                      cust.currentBalance > 0
                        ? highlightedIndex === index
                          ? 'text-amber-300 font-extrabold'
                          : 'text-amber-700'
                        : highlightedIndex === index
                        ? 'text-emerald-200'
                        : 'text-gray-500'
                    }`}
                  >
                    Bal: ₹{formatCurrency(cust.currentBalance)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-gray-500 text-center">
              No matching customers.
            </div>
          )}

          {!hasExact && searchTerm.trim() && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateInstant();
              }}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              className={`p-3 border-t border-gray-200 cursor-pointer flex items-center gap-2 text-sm font-bold ${
                highlightedIndex === filtered.length
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-[#034D28] hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Use "{searchTerm.trim()}" as New Customer</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerAutocomplete;
