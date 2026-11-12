'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '@scc/utils';

export interface AsyncComboboxOption {
  value: string;
  label: string;
}

interface AsyncComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  loadOptions: (search: string, signal: AbortSignal) => Promise<AsyncComboboxOption[]>;
  resolveValue?: (value: string, signal: AbortSignal) => Promise<AsyncComboboxOption | null>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
}

export default function AsyncCombobox({
  label,
  value,
  onChange,
  loadOptions,
  resolveValue,
  placeholder = 'اختر...',
  searchPlaceholder = 'ابحث...',
  emptyLabel = 'لا توجد نتائج',
  clearLabel = 'بدون اختيار',
  required,
  disabled,
  className,
  debounceMs = 300,
}: AsyncComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const resolveRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<AsyncComboboxOption[]>([]);
  const [selected, setSelected] = useState<AsyncComboboxOption | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const local = options.find((option) => option.value === value);
    if (local) {
      setSelected(local);
      return;
    }
    if (!resolveValue) return;
    resolveRef.current?.abort();
    const ctrl = new AbortController();
    resolveRef.current = ctrl;
    resolveValue(value, ctrl.signal)
      .then((option) => {
        if (!ctrl.signal.aborted) setSelected(option);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setSelected(null);
      });
    return () => ctrl.abort();
  }, [value, options, resolveValue]);

  useEffect(() => {
    if (!open) return;
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    const timer = window.setTimeout(() => {
      setLoading(true);
      loadOptions(search.trim(), ctrl.signal)
        .then((rows) => {
          if (!ctrl.signal.aborted) setOptions(rows);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setOptions([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, search, loadOptions, debounceMs]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => () => {
    requestRef.current?.abort();
    resolveRef.current?.abort();
  }, []);

  const choose = (option: AsyncComboboxOption | null) => {
    setSelected(option);
    onChange(option?.value || '');
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={rootRef} className={cn('relative space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-red-400 mr-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'w-full min-h-11 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={cn('truncate text-right', !selected && 'text-slate-500')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-800/70 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto p-1">
            {!required && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                <span>{clearLabel}</span>
                {!value && <X className="h-4 w-4 text-slate-500" />}
              </button>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ البحث...
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-slate-500">{emptyLabel}</div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => choose(option)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-right text-slate-200 hover:bg-slate-800"
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check className="h-4 w-4 shrink-0 text-primary-400" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
