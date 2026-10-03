import React, { useState, useEffect, useRef, useId } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export interface BrandedDatePickerProps {
  id?: string;
  label?: string;
  value: string; // ISO 'YYYY-MM-DD'
  onChange: (isoDate: string) => void;
  minDate?: string; // ISO 'YYYY-MM-DD'
  maxDate?: string; // ISO 'YYYY-MM-DD'
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  isDateDisabled?: (isoDate: string) => boolean;
}

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const parts = iso.split('-').map(p => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  return null;
}

function formatIso(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatFriendlyDate(isoDate: string): string {
  const parsed = parseIso(isoDate);
  if (!parsed) return isoDate || 'Select Date';
  const d = new Date(parsed.year, parsed.month, parsed.day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export const BrandedDatePicker: React.FC<BrandedDatePickerProps> = ({
  id,
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  className = '',
  placeholder = 'Select appointment date',
  ariaLabel,
  isDateDisabled
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Active viewing year & month in calendar view
  const parsedInitial = parseIso(value) || parseIso(minDate || '') || (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  })();

  const [viewYear, setViewYear] = useState(parsedInitial.year);
  const [viewMonth, setViewMonth] = useState(parsedInitial.month);
  const [focusedIso, setFocusedIso] = useState<string>(value || formatIso(parsedInitial.year, parsedInitial.month, parsedInitial.day));

  // Sync viewing month when external value changes
  useEffect(() => {
    const p = parseIso(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setFocusedIso(value);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Handle Escape and keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
      return;
    }

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    // When popover is open, handle keyboard arrows
    const p = parseIso(focusedIso) || { year: viewYear, month: viewMonth, day: 1 };
    const curDate = new Date(p.year, p.month, p.day);

    let handled = true;
    if (e.key === 'ArrowLeft') {
      curDate.setDate(curDate.getDate() - 1);
    } else if (e.key === 'ArrowRight') {
      curDate.setDate(curDate.getDate() + 1);
    } else if (e.key === 'ArrowUp') {
      curDate.setDate(curDate.getDate() - 7);
    } else if (e.key === 'ArrowDown') {
      curDate.setDate(curDate.getDate() + 7);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const iso = formatIso(p.year, p.month, p.day);
      if (!isDayDisabled(iso)) {
        onChange(iso);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
      return;
    } else {
      handled = false;
    }

    if (handled) {
      e.preventDefault();
      const newIso = formatIso(curDate.getFullYear(), curDate.getMonth(), curDate.getDate());
      setFocusedIso(newIso);
      setViewYear(curDate.getFullYear());
      setViewMonth(curDate.getMonth());
    }
  };

  const isDayDisabled = (iso: string): boolean => {
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    if (isDateDisabled && isDateDisabled(iso)) return true;
    return false;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (iso: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDayDisabled(iso) || disabled) return;
    onChange(iso);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Today calculation in local time
  const today = new Date();
  const todayIso = formatIso(today.getFullYear(), today.getMonth(), today.getDate());

  // Generate calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: Array<{
    dayNumber: number;
    iso: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const iso = formatIso(prevYear, prevMonthIdx, day);
    calendarDays.push({
      dayNumber: day,
      iso,
      isCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === value,
      isDisabled: isDayDisabled(iso)
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = formatIso(viewYear, viewMonth, day);
    calendarDays.push({
      dayNumber: day,
      iso,
      isCurrentMonth: true,
      isToday: iso === todayIso,
      isSelected: iso === value,
      isDisabled: isDayDisabled(iso)
    });
  }

  // Next month leading days to complete row grid (multiples of 7)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const iso = formatIso(nextYear, nextMonthIdx, day);
    calendarDays.push({
      dayNumber: day,
      iso,
      isCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === value,
      isDisabled: isDayDisabled(iso)
    });
  }

  const displayText = value ? formatFriendlyDate(value) : placeholder;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[#A9B7C8] mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Primary Trigger Button */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel || (value ? `Consultation date, selected ${displayText}` : placeholder)}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs bg-[#102D4F] border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] flex items-center justify-between transition-all outline-none text-left cursor-pointer hover:border-[rgba(212,168,67,0.40)] focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843] ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isOpen ? 'border-[#D4A843] ring-1 ring-[#D4A843]' : ''}`}
      >
        <span className="flex items-center gap-2.5 truncate font-medium">
          <CalendarIcon className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
          <span className={value ? 'text-[#F8FAFC]' : 'text-[#7F91A6]'}>
            {displayText}
          </span>
        </span>
        <span className="text-[10px] text-[#A9B7C8] uppercase font-semibold tracking-wider ml-2 shrink-0">
          {isOpen ? 'Close' : 'Change'}
        </span>
      </button>

      {/* Hidden input for standard forms and accessibility readers */}
      <input
        type="hidden"
        name={inputId}
        value={value}
        readOnly
      />

      {/* Branded Dark Navy Popover Calendar */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Appointment calendar"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full mt-2 z-50 w-full sm:w-[320px] max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Calendar Header with Month/Year and Navigation */}
          <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.14)] pb-3">
            <h3 className="font-serif text-sm font-bold text-[#F8FAFC]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-lg text-[#A9B7C8] hover:text-[#F8FAFC] hover:bg-[#143657] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#D4A843]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-lg text-[#A9B7C8] hover:text-[#F8FAFC] hover:bg-[#143657] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#D4A843]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map((name, idx) => (
              <div
                key={idx}
                className="text-[11px] font-semibold text-[#7F91A6] py-1"
                aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx]}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1" role="grid">
            {calendarDays.map((cell) => {
              const { dayNumber, iso, isCurrentMonth, isToday, isSelected, isDisabled } = cell;

              let cellStyle = 'text-[#A9B7C8] hover:bg-[#143657] hover:text-[#F8FAFC]';
              if (isSelected) {
                cellStyle = 'bg-[#D4A843] text-[#06182B] font-bold shadow-xs hover:bg-[#E1BB60]';
              } else if (isDisabled) {
                cellStyle = 'text-[#7F91A6]/30 cursor-not-allowed pointer-events-none line-through';
              } else if (!isCurrentMonth) {
                cellStyle = 'text-[#7F91A6]/60 hover:bg-[#143657] hover:text-[#A9B7C8]';
              }

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => handleSelectDay(iso, e)}
                  aria-label={`${MONTH_NAMES[parseIso(iso)?.month || 0]} ${dayNumber}, ${parseIso(iso)?.year || ''}${isSelected ? ' (Selected)' : ''}${isToday ? ' (Today)' : ''}`}
                  aria-selected={isSelected}
                  role="gridcell"
                  className={`relative h-9 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] ${cellStyle}`}
                >
                  <span>{dayNumber}</span>
                  {/* Subtle Today Indicator */}
                  {isToday && !isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 w-1 h-1 rounded-full bg-[#E1BB60]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note / shortcut */}
          <div className="pt-2 border-t border-[rgba(148,163,184,0.14)] flex items-center justify-between text-[11px] text-[#A9B7C8]">
            <span>Today: <strong className="text-[#D4A843]">{formatFriendlyDate(todayIso).split(',')[1]}</strong></span>
            <button
              type="button"
              onClick={() => {
                if (!isDayDisabled(todayIso)) {
                  onChange(todayIso);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }
              }}
              disabled={isDayDisabled(todayIso)}
              className="font-semibold text-[#D4A843] hover:text-[#E1BB60] disabled:opacity-40 disabled:cursor-not-allowed underline focus:outline-none"
            >
              Select Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
