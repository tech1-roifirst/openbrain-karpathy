import { test, expect } from '@playwright/test';

/**
 * Task 6: Form Component with Validation E2E Tests
 *
 * Tests that the generated form component:
 * - Validates on blur
 * - Displays inline error messages
 * - Disables submit until valid
 * - Submits successfully with success message
 * - Is keyboard accessible
 */

test.describe('Task 6: Form Component', () => {
  test('empty form renders with submit button disabled', async ({ page }) => {
    // Navigate to form (assumes it's at a path or component)
    // This is a stub — actual path depends on generated component
    await page.goto('http://localhost:5173/form');

    // Check for form elements
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeDisabled();
  });

  test('invalid email shows error on blur', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('notanemail');
    await emailInput.blur();

    // Check for error message
    const error = page.locator('[role="alert"]').filter({ hasText: /email/i });
    await expect(error).toBeVisible();
  });

  test('password too short shows error on blur', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('short');
    await passwordInput.blur();

    // Check for error message
    const error = page.locator('[role="alert"]').filter({ hasText: /8|password/i });
    await expect(error).toBeVisible();
  });

  test('unchecked terms shows error', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    // Fill email and password validly
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('password123');

    // Submit without checking terms
    const submitButton = page.locator('button[type="submit"]');
    // Button might still be disabled if terms not checked

    if (await submitButton.isEnabled()) {
      await submitButton.click();
      // Error should appear
      const error = page.locator('[role="alert"]').filter({ hasText: /terms/i });
      await expect(error).toBeVisible();
    }
  });

  test('all fields valid enables submit', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    // Fill all fields correctly
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('input[name="terms"]').check();

    // Submit button should be enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  test('successful submit shows success message', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    // Fill form
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('input[name="terms"]').check();

    // Submit
    await page.locator('button[type="submit"]').click();

    // Check for success message
    const success = page.locator('text=/success|created|thank/i');
    await expect(success).toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('http://localhost:5173/form');

    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.press('Tab'); // Focus terms
    await page.keyboard.press('Tab'); // Focus submit

    // Focused element should be submit button
    const focused = page.locator(':focus');
    const focusedType = await focused.evaluate(el => el.getAttribute('type'));
    expect(focusedType).toBe('submit');
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/form');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
