import { cn } from '@scc/utils';
import { forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-slate-300">
            {label}
            {props.required && <span className="text-red-400 mr-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full bg-slate-800/60 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all appearance-none',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-slate-700',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
export default Select;
