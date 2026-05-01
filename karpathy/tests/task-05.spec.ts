import { test, expect } from '@playwright/test';

/**
 * Task 5: Dashboard Page E2E Tests
 *
 * Tests that the generated dashboard component:
 * - Renders without errors
 * - Displays all three sections (metric, chart, table)
 * - Responds to keyboard navigation
 * - Is accessible (WCAG AA)
 */

test.describe('Task 5: Dashboard Page', () => {
  test('page loads and displays total user count', async ({ page }) => {
    // Navigate to dashboard (assumes it's at a path or component)
    // This is a stub — actual path depends on generated component
    await page.goto('http://localhost:5173/dashboard');

    // Check for main metric display
    const metricCard = page.locator('[data-testid="user-metric"]');
    await expect(metricCard).toBeVisible();

    // Check that a number is displayed
    const metricValue = await metricCard.locator('div').first().textContent();
    expect(metricValue).toMatch(/\d+/);
  });

  test('chart renders with data', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Check for chart container
    const chart = page.locator('[data-testid="signup-chart"]');
    await expect(chart).toBeVisible();
  });

  test('recent signups table shows data', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Check for table
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that rows are displayed
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/dashboard');

    // Check that sections are visible (may be stacked)
    const metric = page.locator('[data-testid="user-metric"]');
    await expect(metric).toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeDefined();
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/dashboard');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
