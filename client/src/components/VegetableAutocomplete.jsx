import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Check, Sparkles } from 'lucide-react';

export const VegetableAutocomplete = ({
  value = '',
  vegetables = [],
  onChange,
  onSelect,
  onOpenQuickAdd,
  onEnterNext,
  inputRef,
  placeholder = 'Type vegetable name...',
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Filter vegetables based on English name or Tamil name
  const filtered = vegetables.filter((veg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = veg.name?.toLowerCase().includes(term);
    const tamilMatch = veg.tamilName?.toLowerCase().includes(term);
    return nameMatch || tamilMatch;
  });

  // Check if current search term is an exact match to an existing vegetable
  const hasExactMatch = vegetables.some(
    (v) => v.name?.toLowerCase().trim() === searchTerm.toLowerCase().trim()
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectVegetable = (veg) => {
    setSearchTerm(veg.name);
    setIsOpen(false);
    if (onChange) onChange(veg.name);
    if (onSelect) onSelect(veg);
    if (onEnterNext) onEnterNext();
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    setIsOpen(true);
    setHighlightedIndex(0);
    // Immediately synchronize the particulars text with parent row
    if (onChange) {
      onChange(newVal);
    }
  };

  const handleBlur = () => {
    // When clicking outside or tabbing to next column
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      if (onChange) onChange('');
      return;
    }

    // Check if the typed term matches an existing vegetable case-insensitively
    const matchedVeg = vegetables.find(
      (v) =>
        v.name?.toLowerCase().trim() === trimmed.toLowerCase() ||
        v.tamilName?.trim() === trimmed
    );

    if (matchedVeg) {
      handleSelectVegetable(matchedVeg);
    } else {
      // Preserve the typed name as particulars
      if (onChange) onChange(trimmed);
    }
  };

  const handleKeyDown = (e) => {
    // IME safety: If composing Tamil characters, do not intercept Enter
    if (e.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const totalItems = filtered.length + (!hasExactMatch && searchTerm.trim() ? 1 : 0);
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const totalItems = filtered.length + (!hasExactMatch && searchTerm.trim() ? 1 : 0);
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      }
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        // If highlighted item is within filtered list
        if (highlightedIndex < filtered.length) {
          handleSelectVegetable(filtered[highlightedIndex]);
        } else if (!hasExactMatch && searchTerm.trim()) {
          // Highlighted "+ Add New Vegetable" option
          onOpenQuickAdd(searchTerm.trim());
          setIsOpen(false);
        } else {
          setIsOpen(false);
          if (onEnterNext) onEnterNext();
        }
      } else {
        // Dropdown not open, regular Enter advances to next cell
        if (onEnterNext) {
          e.preventDefault();
          onEnterNext();
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none"
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] bg-white border-2 border-[#034D28] rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
          {/* List of matching vegetables */}
          {filtered.length > 0 ? (
            filtered.map((veg, index) => (
              <div
                key={veg._id || index}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before selection
                  handleSelectVegetable(veg);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                  highlightedIndex === index
                    ? 'bg-[#034D28] text-white'
                    : 'text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{veg.name}</span>
                  {veg.tamilName && (
                    <span
                      className={`text-xs font-tamil ${
                        highlightedIndex === index ? 'text-emerald-200' : 'text-emerald-700'
                      }`}
                    >
                      ({veg.tamilName})
                    </span>
                  )}
                </div>
                {veg.defaultRate > 0 && (
                  <span
                    className={`text-xs font-mono font-bold ${
                      highlightedIndex === index ? 'text-emerald-100' : 'text-gray-500'
                    }`}
                  >
                    ₹{veg.defaultRate}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-gray-500 text-center">
              No matching vegetables found.
            </div>
          )}

          {/* Quick Add New Vegetable Row */}
          {!hasExactMatch && searchTerm.trim() && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                onOpenQuickAdd(searchTerm.trim());
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              className={`p-2.5 border-t border-gray-200 cursor-pointer flex items-center gap-2 text-sm font-bold ${
                highlightedIndex === filtered.length
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-[#034D28] hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>
                Add "<strong>{searchTerm.trim()}</strong>" as New Vegetable
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VegetableAutocomplete;
