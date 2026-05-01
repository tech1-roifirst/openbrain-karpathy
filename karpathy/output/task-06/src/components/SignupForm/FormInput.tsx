import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { FormError } from './FormError';

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Used for the input id, label htmlFor, and the aria-describedby target. */
  id: string;
  label: string;
  /** When set, the field is rendered in an error state. */
  error?: string;
  /** Marks the field as required visually + via `aria-required`. */
  required?: boolean;
  /** Optional helper text shown below the input when there is no error. */
  helperText?: string;
}

/**
 * Reusable text input with label + inline error. Forwards its ref so the
 * parent hook can move focus to the first invalid field on a submit attempt.
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  { id, label, error, required, helperText, className, type = 'text', ...rest },
  ref,
) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);

  // aria-describedby points to whichever annotation is currently visible.
  const describedBy = hasError ? errorId : helperText ? helperId : undefined;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger-text">
            *
          </span>
        )}
      </label>

      <input
        {...rest}
        ref={ref}
        id={id}
        type={type}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        data-testid={`${id}-input`}
        className={cn(
          // Base
          'block w-full rounded-md border bg-white px-3 py-2.5 text-base text-ink',
          'shadow-sm transition-colors duration-150',
          'placeholder:text-gray-400',
          // Focus
          'focus:outline-none focus:ring-2 focus:ring-offset-1',
          // State variants
          hasError
            ? 'border-danger-border bg-danger-bg focus:border-danger-text focus:ring-danger-text/40'
            : 'border-border focus:border-border-focus focus:ring-border-focus/40',
          // Disabled
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          className,
        )}
      />

      {hasError ? (
        <FormError id={errorId} message={error} />
      ) : helperText ? (
        <p id={helperId} className="mt-1.5 text-sm text-gray-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
