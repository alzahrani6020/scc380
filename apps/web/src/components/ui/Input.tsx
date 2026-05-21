import { cn } from '@scc/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-slate-300">
            {label}
            {props.required && <span className="text-red-400 mr-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-slate-800/60 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-slate-700',
            className
          )}
          {...props}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {helper && !error && <p className="text-slate-500 text-xs">{helper}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
export default Input;
