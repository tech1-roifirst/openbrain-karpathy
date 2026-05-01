import type { FormEvent } from 'react';

/**
 * Shape of the form's user-editable values. The shape stays flat to keep
 * field handlers strongly typed via `keyof SignupFormData`.
 */
export interface SignupFormData {
  email: string;
  password: string;
  terms: boolean;
}

/** Each field's error message. Empty/missing means "no error". */
export type SignupFormErrors = Partial<Record<keyof SignupFormData, string>>;

/** Tracks whether the user has interacted with (blurred away from) a field. */
export type SignupFormTouched = Record<keyof SignupFormData, boolean>;

/** Result returned by every field-level validator. */
export interface FieldValidationResult {
  valid: boolean;
  error?: string;
}

/** Aggregate result returned by the form-level validator. */
export interface FormValidationResult {
  isValid: boolean;
  errors: SignupFormErrors;
}

/** Public API of the `useSignupForm` hook — exported so consumers can type props. */
export interface UseSignupFormReturn {
  formData: SignupFormData;
  errors: SignupFormErrors;
  touched: SignupFormTouched;
  isValid: boolean;
  isSubmitting: boolean;
  successMessage: string | null;
  submitError: string | null;
  setFieldValue: <K extends keyof SignupFormData>(
    field: K,
    value: SignupFormData[K],
  ) => void;
  setFieldTouched: (field: keyof SignupFormData) => void;
  handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  resetForm: () => void;
  /**
   * Imperatively register an input ref so the hook can move focus to the first
   * invalid field on a submit attempt. Pass `null` on unmount.
   */
  registerFieldRef: (
    field: keyof SignupFormData,
    el: HTMLInputElement | null,
  ) => void;
}
