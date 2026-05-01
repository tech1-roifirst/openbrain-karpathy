import { Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { useSignupForm } from '../../hooks/useSignupForm';
import { cn } from '../../lib/cn';
import { FormCheckbox } from './FormCheckbox';
import { FormError } from './FormError';
import { FormInput } from './FormInput';
import { SuccessMessage } from './SuccessMessage';

interface SignupFormProps {
  className?: string;
}

/**
 * Top-level signup form. Logic lives in `useSignupForm`; this component is
 * the layout / presentation layer.
 *
 * Tab order: email → password → terms → submit. Browser default tab order
 * already matches DOM order, so we don't override `tabIndex`.
 */
export function SignupForm({ className }: SignupFormProps) {
  const {
    formData,
    errors,
    touched,
    isValid,
    isSubmitting,
    successMessage,
    submitError,
    setFieldValue,
    setFieldTouched,
    handleSubmit,
    registerFieldRef,
  } = useSignupForm();

  // Only show field-level errors after the user has interacted with the field.
  const visibleEmailError = touched.email ? errors.email : undefined;
  const visiblePasswordError = touched.password ? errors.password : undefined;
  const visibleTermsError = touched.terms ? errors.terms : undefined;

  const setEmailRef = useCallback(
    (el: HTMLInputElement | null) => registerFieldRef('email', el),
    [registerFieldRef],
  );
  const setPasswordRef = useCallback(
    (el: HTMLInputElement | null) => registerFieldRef('password', el),
    [registerFieldRef],
  );
  const setTermsRef = useCallback(
    (el: HTMLInputElement | null) => registerFieldRef('terms', el),
    [registerFieldRef],
  );

  return (
    <section
      className={cn(
        'mx-auto w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm',
        'sm:p-8',
        className,
      )}
      aria-labelledby="signup-heading"
    >
      <header className="mb-6">
        <h1 id="signup-heading" className="text-2xl font-semibold text-ink">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign up to get started. It only takes a minute.
        </p>
      </header>

      {successMessage && <SuccessMessage message={successMessage} className="mb-4" />}

      <form
        noValidate
        onSubmit={handleSubmit}
        data-testid="signup-form"
        aria-describedby={submitError ? 'submit-error' : undefined}
      >
        <div className="space-y-5">
          <FormInput
            ref={setEmailRef}
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
            value={formData.email}
            error={visibleEmailError}
            disabled={isSubmitting}
            onChange={(e) => setFieldValue('email', e.target.value)}
            onBlur={() => setFieldTouched('email')}
          />

          <FormInput
            ref={setPasswordRef}
            id="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            value={formData.password}
            error={visiblePasswordError}
            helperText={!visiblePasswordError ? 'Use 8 or more characters.' : undefined}
            disabled={isSubmitting}
            onChange={(e) => setFieldValue('password', e.target.value)}
            onBlur={() => setFieldTouched('password')}
          />

          <FormCheckbox
            ref={setTermsRef}
            id="terms"
            required
            checked={formData.terms}
            error={visibleTermsError}
            ariaLabel="I agree to the terms and conditions"
            disabled={isSubmitting}
            onChange={(e) => setFieldValue('terms', e.target.checked)}
            onBlur={() => setFieldTouched('terms')}
            label={
              <>
                I agree to the{' '}
                <a
                  href="#terms"
                  className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark focus-visible:text-brand-dark"
                  aria-label="Read the terms and conditions"
                >
                  Terms and Conditions
                </a>
              </>
            }
          />
        </div>

        {submitError && (
          <FormError id="submit-error" message={submitError} className="mt-4" />
        )}

        <button
          type="submit"
          data-testid="submit-button"
          disabled={!isValid || isSubmitting}
          aria-disabled={!isValid || isSubmitting}
          className={cn(
            'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md',
            'px-4 py-2.5 text-sm font-semibold text-white shadow-sm',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isValid && !isSubmitting
              ? 'bg-brand hover:bg-brand-dark focus-visible:ring-brand cursor-pointer'
              : 'bg-brand-disabled cursor-not-allowed',
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              <span>Creating account…</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>

        {/* Polite live region used during submission for SR feedback. */}
        <span className="sr-only" aria-live="polite">
          {isSubmitting ? 'Submitting form, please wait.' : ''}
        </span>
      </form>
    </section>
  );
}
