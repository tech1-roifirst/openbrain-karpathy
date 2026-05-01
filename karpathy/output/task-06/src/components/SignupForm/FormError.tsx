import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface FormErrorProps {
  /** DOM id used by `aria-describedby` on the matching field. */
  id: string;
  /** Error copy to render. Component renders nothing if falsy. */
  message?: string;
  className?: string;
}

/**
 * Inline error row for a form field. Includes an icon plus text so the
 * indicator is NOT colour-only (WCAG SC 1.4.1).
 *
 * The host field flips `aria-invalid` and points `aria-describedby` here, so
 * screen readers announce this text whenever it appears.
 */
export function FormError({ id, message, className }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger-text animate-fadeIn',
        className,
      )}
      data-testid={`${id}-text`}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </p>
  );
}
