import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { submitSignup } from '../lib/submitSignup';
import {
  validateEmail,
  validateForm,
  validatePassword,
  validateTerms,
} from '../lib/validation';
import type {
  FieldValidationResult,
  SignupFormData,
  SignupFormErrors,
  SignupFormTouched,
  UseSignupFormReturn,
} from '../types/signup';

const INITIAL_DATA: SignupFormData = {
  email: '',
  password: '',
  terms: false,
};

const INITIAL_TOUCHED: SignupFormTouched = {
  email: false,
  password: false,
  terms: false,
};

/** How long we wait after the last keystroke before re-running validation. */
const VALIDATION_DEBOUNCE_MS = 350;

/** Centralised dispatch — keeps `setFieldTouched` and the debounce closure DRY. */
function validateField(
  field: keyof SignupFormData,
  data: SignupFormData,
): FieldValidationResult {
  switch (field) {
    case 'email':
      return validateEmail(data.email);
    case 'password':
      return validatePassword(data.password);
    case 'terms':
      return validateTerms(data.terms);
  }
}

/**
 * Centralised form state machine.
 *
 *  - `formData`     — the user-editable values (controlled)
 *  - `errors`       — last-computed validation messages, keyed by field
 *  - `touched`      — true once the user has blurred a field at least once
 *  - `isValid`      — true when every field passes validation right now
 *  - `isSubmitting` — guard against double submits & drives the spinner
 *  - `successMessage` / `submitError` — non-null while either is shown
 *
 * Validation strategy: we compute `errors` for ALL fields on every change so
 * `isValid` is always correct (the submit button needs reactive truth), but
 * the UI only DISPLAYS an error once the field has been blurred OR after a
 * submit attempt. The actual update of `errors` for typed fields runs through
 * a 350ms debounce so the user doesn't see flicker mid-keystroke.
 */
export function useSignupForm(): UseSignupFormReturn {
  const [formData, setFormData] = useState<SignupFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [touched, setTouched] = useState<SignupFormTouched>(INITIAL_TOUCHED);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs to live input nodes — used for focus-first-invalid on submit attempts.
  const fieldRefs = useRef<Record<keyof SignupFormData, HTMLInputElement | null>>({
    email: null,
    password: null,
    terms: null,
  });

  // Debounce timer for re-validating typed fields without re-rendering on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-fresh references to `touched` and `formData` so callbacks stay
  // stable across renders (no stale-closure bugs from the debounced timer).
  const touchedRef = useRef(touched);
  const formDataRef = useRef(formData);
  useEffect(() => {
    touchedRef.current = touched;
  }, [touched]);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  /** Compute the always-true reactive validity for the submit button. */
  const isValid = useMemo(() => validateForm(formData).isValid, [formData]);

  /** Cleanup debounce timer on unmount to avoid setting state after unmount. */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const registerFieldRef = useCallback(
    (field: keyof SignupFormData, el: HTMLInputElement | null) => {
      fieldRefs.current[field] = el;
    },
    [],
  );

  const setFieldValue = useCallback(
    <K extends keyof SignupFormData>(field: K, value: SignupFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear submit-level state as soon as the user edits anything again.
      setSuccessMessage(null);
      setSubmitError(null);

      // Checkbox: get truthy intent immediately — clear/keep the error inline.
      if (field === 'terms') {
        setErrors((prev) => {
          const result = validateTerms(value as boolean);
          if (result.valid) {
            if (!prev.terms) return prev;
            const next = { ...prev };
            delete next.terms;
            return next;
          }
          // Field invalid: only show the error if the user has already blurred it.
          if (touchedRef.current.terms && result.error) {
            return { ...prev, terms: result.error };
          }
          return prev;
        });
        return;
      }

      // Text fields: clear stale errors immediately so the red state lifts as
      // the user corrects input, then re-validate after a debounce window.
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Only surface an error if the user has touched the field; otherwise
        // we'd flash an error before they ever blurred — bad UX.
        if (!touchedRef.current[field]) return;
        const data = { ...formDataRef.current, [field]: value };
        const result = validateField(field, data);
        setErrors((prev) => {
          if (result.valid) {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
          }
          return { ...prev, [field]: result.error };
        });
      }, VALIDATION_DEBOUNCE_MS);
    },
    [],
  );

  const setFieldTouched = useCallback((field: keyof SignupFormData) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

    // Run validation immediately on blur using the latest committed values.
    const result = validateField(field, formDataRef.current);
    setErrors((prev) => {
      if (result.valid) {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: result.error };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_DATA);
    setErrors({});
    setTouched(INITIAL_TOUCHED);
    setSubmitError(null);
    setSuccessMessage(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();

      // Mark every field touched so any lingering errors become visible.
      setTouched({ email: true, password: true, terms: true });

      const data = formDataRef.current;
      const result = validateForm(data);
      setErrors(result.errors);

      if (!result.isValid) {
        // Move focus to the first invalid field for keyboard / SR users.
        const order: (keyof SignupFormData)[] = ['email', 'password', 'terms'];
        const firstInvalid = order.find((f) => result.errors[f]);
        if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await submitSignup(data.email, data.password);
        setSuccessMessage('Account created successfully. Check your inbox to confirm.');
        // Reset form fields but KEEP the success message until the user re-engages.
        setFormData(INITIAL_DATA);
        setErrors({});
        setTouched(INITIAL_TOUCHED);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
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
    resetForm,
    registerFieldRef,
  };
}
