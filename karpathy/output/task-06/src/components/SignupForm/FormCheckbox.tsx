import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FormError } from './FormError';

interface FormCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'children'> {
  id: string;
  /** Label content — supports inline links (e.g. "I agree to the <a>Terms</a>"). */
  label: ReactNode;
  /** Plain-text version of the label, used when the label contains JSX so SRs get a clean string. */
  ariaLabel?: string;
  error?: string;
  required?: boolean;
}

/**
 * Custom-styled checkbox that delegates to a real `<input type="checkbox">`
 * (kept visually hidden but focusable / keyboard operable). The visible square
 * is a sibling element styled via peer-checked utilities.
 */
export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  function FormCheckbox(
    { id, label, ariaLabel, error, required, className, checked, ...rest },
    ref,
  ) {
    const errorId = `${id}-error`;
    const hasError = Boolean(error);

    return (
      <div className={cn('w-full', className)}>
        <div className="flex items-start gap-3">
          <div className="relative flex h-6 items-center">
            <input
              {...rest}
              ref={ref}
              id={id}
              type="checkbox"
              checked={checked}
              aria-invalid={hasError || undefined}
              aria-required={required || undefined}
              aria-describedby={hasError ? errorId : undefined}
              aria-label={ariaLabel}
              data-testid={`${id}-input`}
              // Keep the native input present (peer) but visually styled by the box below.
              className={cn(
                'peer h-5 w-5 cursor-pointer rounded border-2 bg-white',
                'appearance-none transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-offset-1',
                hasError
                  ? 'border-danger-border focus:ring-danger-text/40'
                  : 'border-border focus:border-border-focus focus:ring-border-focus/40',
                'checked:border-brand checked:bg-brand',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            {/* Checkmark overlay — only visible when checked. */}
            <Check
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-white',
                'opacity-0 peer-checked:opacity-100',
                'transition-opacity duration-150',
              )}
              strokeWidth={3}
            />
          </div>

          <label htmlFor={id} className="cursor-pointer select-none text-sm leading-6 text-ink">
            {label}
            {required && (
              <span aria-hidden="true" className="ml-0.5 text-danger-text">
                *
              </span>
            )}
          </label>
        </div>

        <FormError id={errorId} message={error} className="ml-8" />
      </div>
    );
  },
);
