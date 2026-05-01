import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SuccessMessageProps {
  message: string;
  className?: string;
}

/**
 * Inline success banner. Uses `role="alert"` so screen readers announce the
 * confirmation as soon as it appears. Includes a check icon so the indicator
 * is not colour-only.
 */
export function SuccessMessage({ message, className }: SuccessMessageProps) {
  return (
    <div
      role="alert"
      data-testid="success-message"
      className={cn(
        'flex items-start gap-3 rounded-md border border-success-check/30 bg-success-bg',
        'px-4 py-3 text-success-text animate-fadeIn',
        className,
      )}
    >
      <CheckCircle2
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-check"
      />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
