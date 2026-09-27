import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

export type BrandedSelectOption = SelectOption;

export interface BrandedSelectProps {
  id?: string;
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  searchable?: boolean;
  variant?: 'light' | 'dark'; // 'light' for ivory surface (#FBF8F1), 'dark' for deep navy (#0D2746)
  className?: string;
}

export const BrandedSelect: React.FC<BrandedSelectProps> = ({
  id: propId,
  label,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  helpText,
  searchable,
  variant = 'light',
  className = '',
}) => {
  const generatedId = useId();
  const selectId = propId || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const isLight = variant === 'light';

  // Filter options if there are > 8 options or searchable is explicitly true and user typed search
  const safeOptions = options || [];
  const showSearch = searchable !== undefined ? searchable : safeOptions.length > 8;
  const filteredOptions = showSearch && searchTerm.trim()
    ? safeOptions.filter(opt =>
        (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : safeOptions;

  const selectedOption = safeOptions.find(opt => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Focus search input when opening if search is visible
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Sync focused index with selected option when opening
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex(opt => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          scrollToOption(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          scrollToOption(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const opt = filteredOptions[focusedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
            setSearchTerm('');
            buttonRef.current?.focus();
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  const scrollToOption = (index: number) => {
    if (listboxRef.current) {
      const children = listboxRef.current.children;
      if (children[index]) {
        (children[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSelectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    setSearchTerm('');
    buttonRef.current?.focus();
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
            isLight ? 'text-[#10233D]' : 'text-[#E2B957]'
          }`}
        >
          {label}
          {required && <span className="text-[#B42318] ml-1">*</span>}
        </label>
      )}

      {/* Select trigger button */}
      <button
        id={selectId}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && focusedIndex >= 0 && filteredOptions[focusedIndex]
            ? `${selectId}-opt-${focusedIndex}`
            : undefined
        }
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 border transition-all ${
          disabled
            ? isLight
              ? 'bg-[#EAD7A3]/30 text-[#718096] border-[#D8C9A5] cursor-not-allowed'
              : 'bg-[#081E36]/50 text-[#718096] border-[#244567] cursor-not-allowed'
            : isLight
              ? error
                ? 'bg-[#FBF8F1] text-[#10233D] border-[#B42318] ring-1 ring-[#B42318]'
                : isOpen
                  ? 'bg-[#FBF8F1] text-[#10233D] border-[#B98B32] ring-2 ring-[#C99A3D]'
                  : 'bg-[#FBF8F1] text-[#10233D] border-[#D8C9A5] hover:border-[#B98B32] hover:bg-[#F7F1E5]'
              : error
                ? 'bg-[#0D2746] text-[#F7F1E5] border-[#B42318] ring-1 ring-[#B42318]'
                : isOpen
                  ? 'bg-[#0D2746] text-[#F7F1E5] border-[#E2B957] ring-2 ring-[#C99A3D]'
                  : 'bg-[#0D2746] text-[#F7F1E5] border-[#244567] hover:border-[#C99A3D]'
        }`}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-bold">{selectedOption.label}</span>
          ) : (
            <span className={isLight ? 'text-[#52657B]' : 'text-slate-400'}>
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            isLight ? 'text-[#10233D]' : 'text-[#E2B957]'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-[80] overflow-hidden ${
            isLight
              ? 'bg-[#FBF8F1] border-[#B98B32] text-[#10233D]'
              : 'bg-[#0D2746] border-[#C99A3D]/60 text-[#F7F1E5]'
          }`}
        >
          {/* Quick search input if more than 8 choices */}
          {showSearch && (
            <div className={`p-2 border-b ${isLight ? 'border-[#D8C9A5] bg-[#F7F1E5]' : 'border-[#244567] bg-[#081E36]'}`}>
              <div className="relative flex items-center">
                <Search className={`w-3.5 h-3.5 absolute left-2.5 ${isLight ? 'text-[#52657B]' : 'text-slate-400'}`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Filter options..."
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none font-medium ${
                    isLight
                      ? 'bg-white border-[#D8C9A5] text-[#10233D] placeholder-[#52657B] focus:border-[#C99A3D]'
                      : 'bg-[#06172C] border-[#244567] text-[#F7F1E5] placeholder-slate-400 focus:border-[#E2B957]'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Options listbox */}
          <ul
            id={listboxId}
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-60 overflow-y-auto py-1 text-xs focus:outline-none"
          >
            {filteredOptions.length === 0 ? (
              <li className={`px-4 py-3 text-center text-xs font-medium ${isLight ? 'text-[#52657B]' : 'text-slate-400'}`}>
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isFocused = idx === focusedIndex;

                return (
                  <li
                    key={opt.value}
                    id={`${selectId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors min-h-[40px] ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#E2B957] text-[#06172C] font-bold shadow-sm'
                          : isFocused
                            ? isLight
                              ? 'bg-[#F4E7C3] text-[#10233D]'
                              : 'bg-[#14375D] text-[#F7F1E5]'
                            : isLight
                              ? 'text-[#10233D] hover:bg-[#F4E7C3]'
                              : 'text-[#F7F1E5] hover:bg-[#14375D]'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{opt.label}</span>
                        {opt.badge && (
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-[#06172C] text-[#E2B957]'
                              : isLight
                                ? 'bg-[#F7F1E5] text-[#B87319] border border-[#D8C9A5]'
                                : 'bg-[#06172C] text-[#E2B957] border border-[#244567]'
                          }`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <span className={`text-[11px] truncate mt-0.5 ${
                          isSelected
                            ? 'text-[#06172C]/80 font-medium'
                            : isLight
                              ? 'text-[#52657B]'
                              : 'text-slate-300'
                        }`}>
                          {opt.description}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0 text-[#06172C]" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {/* Error or Help Text */}
      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-[#B42318] flex items-center gap-1">
          <span>{error}</span>
        </p>
      ) : helpText ? (
        <p className={`mt-1 text-[11px] ${isLight ? 'text-[#52657B]' : 'text-slate-400'}`}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
};
