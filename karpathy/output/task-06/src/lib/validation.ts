import type {
  FieldValidationResult,
  FormValidationResult,
  SignupFormData,
} from '../types/signup';

/**
 * Pragmatic email regex. The HTML5 spec's regex is the source of truth, but
 * this version is strict enough to catch typos like "notanemail" while still
 * accepting realistic addresses such as `a+b@example.co.uk`.
 *
 * It deliberately does NOT try to enforce RFC 5322 — that's a server concern.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN_LENGTH = 8;

/** Standardised error copy. Centralised so tests + UI stay in sync. */
export const ERROR_MESSAGES = {
  emailRequired: 'Please enter a valid email address',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  passwordTooShort: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  termsRequired: 'You must agree to the terms and conditions',
} as const;

export function validateEmail(email: string): FieldValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: ERROR_MESSAGES.emailRequired };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: ERROR_MESSAGES.emailInvalid };
  }
  return { valid: true };
}

export function validatePassword(password: string): FieldValidationResult {
  if (!password) {
    return { valid: false, error: ERROR_MESSAGES.passwordRequired };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.passwordTooShort };
  }
  return { valid: true };
}

export function validateTerms(checked: boolean): FieldValidationResult {
  if (!checked) {
    return { valid: false, error: ERROR_MESSAGES.termsRequired };
  }
  return { valid: true };
}

/**
 * Validate every field in one pass. Used both for the disable-when-invalid
 * gating (so the submit button is reactive) and for the on-submit hard gate.
 */
export function validateForm(data: SignupFormData): FormValidationResult {
  const emailResult = validateEmail(data.email);
  const passwordResult = validatePassword(data.password);
  const termsResult = validateTerms(data.terms);

  const errors: FormValidationResult['errors'] = {};
  if (!emailResult.valid && emailResult.error) errors.email = emailResult.error;
  if (!passwordResult.valid && passwordResult.error) errors.password = passwordResult.error;
  if (!termsResult.valid && termsResult.error) errors.terms = termsResult.error;

  return {
    isValid: emailResult.valid && passwordResult.valid && termsResult.valid,
    errors,
  };
}
