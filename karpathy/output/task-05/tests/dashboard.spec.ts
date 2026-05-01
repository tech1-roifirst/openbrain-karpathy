import { test, expect, type Page } from '@playwright/test';

const ROUTE = '/';

async function gotoDashboard(page: Page) {
  await page.goto(ROUTE);
}

test.describe('Dashboard — success path', () => {
  test('loads and displays total user count', async ({ page }) => {
    await gotoDashboard(page);
    const value = page.getByTestId('metric-card-value');
    await expect(value).toBeVisible({ timeout: 5_000 });
    await expect(value).toHaveText('1,234');
  });

  test('chart renders with at least 10 data points', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByTestId('signup-chart')).toBeVisible({ timeout: 5_000 });
    const dots = page.locator('[data-testid="signup-chart"] .recharts-line-dot');
    await expect.poll(async () => dots.count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(10);
  });

  test('recent signups table shows 5 rows with expected content', async ({ page }) => {
    await gotoDashboard(page);
    const rows = page.getByTestId('recent-signup-row');
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText('Alex Morgan');
    await expect(rows.first()).toContainText('alex.morgan@example.com');
    await expect(rows.first().locator('time')).toBeVisible();
  });

  test('table is sorted by date descending', async ({ page }) => {
    await gotoDashboard(page);
    const times = await page
      .locator('[data-testid="recent-signup-row"] time')
      .evaluateAll((els) => els.map((e) => e.getAttribute('datetime') ?? ''));
    const sorted = [...times].sort((a, b) => (a < b ? 1 : -1));
    expect(times).toEqual(sorted);
  });
});

test.describe('Dashboard — responsive layout', () => {
  test('mobile (375px) stacks sections vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await gotoDashboard(page);
    await expect(page.getByTestId('dashboard-grid')).toBeVisible({ timeout: 5_000 });

    const metricBox = await page.getByTestId('metric-card').boundingBox();
    const chartBox = await page.getByTestId('signup-chart').boundingBox();
    const tableBox = await page.getByTestId('recent-signups').boundingBox();
    expect(metricBox && chartBox && tableBox).toBeTruthy();
    expect(chartBox!.y).toBeGreaterThan(metricBox!.y + metricBox!.height - 1);
    expect(tableBox!.y).toBeGreaterThan(chartBox!.y + chartBox!.height - 1);
  });

  test('tablet (768px) — metric card spans full width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoDashboard(page);
    await expect(page.getByTestId('dashboard-grid')).toBeVisible({ timeout: 5_000 });
    const metricBox = await page.getByTestId('metric-card').boundingBox();
    const chartBox = await page.getByTestId('signup-chart').boundingBox();
    expect(metricBox!.width).toBeGreaterThan(chartBox!.width * 0.95);
  });

  test('desktop (1280px) — chart and table sit on the same row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoDashboard(page);
    await expect(page.getByTestId('signup-chart')).toBeVisible({ timeout: 5_000 });
    const chartBox = await page.getByTestId('signup-chart').boundingBox();
    const tableBox = await page.getByTestId('recent-signups').boundingBox();
    expect(Math.abs(chartBox!.y - tableBox!.y)).toBeLessThan(20);
    expect(tableBox!.x).toBeGreaterThan(chartBox!.x + chartBox!.width - 50);
  });
});

test.describe('Dashboard — accessibility', () => {
  test('skip link is the first focusable element', async ({ page }) => {
    await gotoDashboard(page);
    await page.keyboard.press('Tab');
    const href = await page.evaluate(() =>
      (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'),
    );
    expect(href).toBe('#dashboard-main');
  });

  test('keyboard tab order reaches mailto links', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByTestId('metric-card-value')).toBeVisible({ timeout: 5_000 });

    const focused: string[] = [];
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const desc = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        return `${el.tagName}:${el.getAttribute('href') ?? ''}`;
      });
      focused.push(desc);
    }
    expect(focused.some((f) => f.includes('mailto:'))).toBe(true);
  });

  test('focused link has a visible focus indicator', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByTestId('recent-signups')).toBeVisible({ timeout: 5_000 });
    const firstEmail = page.locator('a[href^="mailto:"]').first();
    await firstEmail.focus();
    const outline = await firstEmail.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        outlineWidth: cs.outlineWidth,
        outlineStyle: cs.outlineStyle,
        boxShadow: cs.boxShadow,
      };
    });
    const visible =
      outline.outlineStyle !== 'none' ||
      parseFloat(outline.outlineWidth) > 0 ||
      outline.boxShadow !== 'none';
    expect(visible).toBe(true);
  });

  test('semantic landmarks are present', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    // 4 sections: 1 header? actually <section> for metric/chart/table = at least 3.
    const sectionCount = await page.locator('section').count();
    expect(sectionCount).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Dashboard — loading & error states', () => {
  test('skeleton renders before data resolves', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByTestId('dashboard-skeleton')).toBeVisible();
    await expect(page.getByTestId('metric-card')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('dashboard-skeleton')).toBeHidden();
  });

  test('skeleton announces loading via aria-live', async ({ page }) => {
    await gotoDashboard(page);
    const skeleton = page.getByTestId('dashboard-skeleton');
    await expect(skeleton).toHaveAttribute('aria-live', 'polite');
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });
});

test.describe('Dashboard — console hygiene', () => {
  test('no app-level console errors or warnings during render', async ({ page }) => {
    const messages: { type: string; text: string }[] = [];
    page.on('console', (msg) => {
      const t = msg.type();
      if (t === 'error' || t === 'warning') messages.push({ type: t, text: msg.text() });
    });
    await gotoDashboard(page);
    await expect(page.getByTestId('metric-card')).toBeVisible({ timeout: 5_000 });
    const ours = messages.filter(
      (m) =>
        !m.text.includes('React Router') &&
        !m.text.includes('DevTools') &&
        !m.text.toLowerCase().includes('source map'),
    );
    expect(ours, JSON.stringify(ours, null, 2)).toEqual([]);
  });
});
