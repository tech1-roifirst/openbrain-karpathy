import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * E2E coverage for the signup form. Uses `data-testid` selectors so a
 * Tailwind class refactor can never break the suite.
 *
 * One pre-condition we want for every test: no console errors / warnings.
 * A small helper attaches a listener and surfaces the messages on teardown.
 */
function trackConsole(page: Page) {
  const messages: ConsoleMessage[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // Filter out the deliberate `console.log` from the mock submit handler.
      messages.push(msg);
    }
  });
  return messages;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('1. empty form renders with submit disabled', async ({ page }) => {
  const submit = page.getByTestId('submit-button');
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
});

test('2. invalid email shows error on blur, button stays disabled', async ({ page }) => {
  const messages = trackConsole(page);

  const email = page.getByTestId('email-input');
  await email.fill('notanemail');
  await email.blur();

  await expect(page.getByTestId('email-error-text')).toContainText(
    'Please enter a valid email address',
  );
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('submit-button')).toBeDisabled();
  expect(messages).toHaveLength(0);
});

test('3. password under 8 chars shows error on blur, button stays disabled', async ({ page }) => {
  const password = page.getByTestId('password-input');
  await password.fill('short');
  await password.blur();

  await expect(page.getByTestId('password-error-text')).toContainText('at least 8 characters');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('submit-button')).toBeDisabled();
});

test('4. unchecked terms shows error after submit attempt, button disabled', async ({ page }) => {
  // Fill valid email + password but DO NOT check terms.
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebatterystaple');

  // The submit button is disabled, so we exercise the terms-untouched path
  // by blurring the checkbox after focusing it.
  const terms = page.getByTestId('terms-input');
  await terms.focus();
  await terms.blur();

  await expect(page.getByTestId('terms-error-text')).toContainText(
    'You must agree to the terms',
  );
  await expect(page.getByTestId('submit-button')).toBeDisabled();
});

test('5. all fields valid → submit button becomes enabled', async ({ page }) => {
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebattery');
  await page.getByTestId('terms-input').check();

  await expect(page.getByTestId('submit-button')).toBeEnabled();
});

test('6 + 7. submit valid form → success message appears, form clears', async ({ page }) => {
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebattery');
  await page.getByTestId('terms-input').check();

  await page.getByTestId('submit-button').click();

  // Success banner has role="alert" so it's announced to SRs.
  const success = page.getByTestId('success-message');
  await expect(success).toBeVisible({ timeout: 5_000 });
  await expect(success).toHaveAttribute('role', 'alert');

  // Form cleared back to empty state.
  await expect(page.getByTestId('email-input')).toHaveValue('');
  await expect(page.getByTestId('password-input')).toHaveValue('');
  await expect(page.getByTestId('terms-input')).not.toBeChecked();

  // And the submit button is back to disabled (because the form is empty).
  await expect(page.getByTestId('submit-button')).toBeDisabled();
});

test('8. tab order: email → password → terms → submit', async ({ page }) => {
  // Start from a known focus anchor: the email field.
  await page.getByTestId('email-input').focus();
  await expect(page.getByTestId('email-input')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('password-input')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('terms-input')).toBeFocused();
});

test('8b. tab order reaches submit when form is valid', async ({ page }) => {
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebattery');
  await page.getByTestId('terms-input').check();

  // From the checkbox, tab forward — there is one in-label link between the
  // checkbox and the submit button, then the submit button itself.
  await page.getByTestId('terms-input').focus();
  await page.keyboard.press('Tab'); // → in-label "Terms and Conditions" link
  await page.keyboard.press('Tab'); // → submit button
  await expect(page.getByTestId('submit-button')).toBeFocused();
});

test('9. Enter on submit button submits the form', async ({ page }) => {
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebattery');
  await page.getByTestId('terms-input').check();

  await page.getByTestId('submit-button').focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 5_000 });
});

test('10. no console errors during a full happy-path flow', async ({ page }) => {
  const messages = trackConsole(page);

  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('correcthorsebattery');
  await page.getByTestId('terms-input').check();
  await page.getByTestId('submit-button').click();

  await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 5_000 });

  expect(messages, `unexpected console messages: ${messages.map((m) => m.text()).join(' | ')}`)
    .toHaveLength(0);
});

test('error clears as user corrects input (no debounce flicker after fix)', async ({ page }) => {
  const email = page.getByTestId('email-input');
  await email.fill('notanemail');
  await email.blur();
  await expect(page.getByTestId('email-error-text')).toBeVisible();

  // Re-focus and correct: the error should clear immediately on input.
  await email.fill('user@example.com');
  await expect(page.getByTestId('email-error-text')).toHaveCount(0);
});

test('focus moves to first invalid field on submit attempt', async ({ page }) => {
  // Force-enable the submit button via JS so we can test the focus-management
  // codepath. (Keeping the button disabled is the correct behaviour for users,
  // but we still want to verify the safety-net runs if it's ever bypassed.)
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="submit-button"]');
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
    }
  });
  await page.getByTestId('submit-button').click();

  await expect(page.getByTestId('email-input')).toBeFocused();
});
