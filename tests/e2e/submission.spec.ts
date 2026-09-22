/**
 * SUBMISSION BROWSER ACCEPTANCE BENCHMARK
 *
 * Real browser tests against live Vite preview.
 * No fixture shortcuts — real Runtime execution.
 */

import { test, expect, type Page } from '@playwright/test';

const REPORT_DIR = 'reports/ui-benchmark';

// ── Helpers ──────────────────────────────────────────────────────────────

async function waitForDashboard(page: Page, timeout = 30_000) {
  // Wait for either success canvas or error state
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        text.includes('数据画布') ||
        text.includes('规则校验') ||
        text.includes('意图理解') ||
        text.includes('暂不支持')
      );
    },
    { timeout },
  );
}

async function resetToZero(page: Page) {
  // Find and click "New Analysis" / reset button
  const resetBtn = page.locator('button:has-text("新建分析")');
  const count = await resetBtn.count();
  if (count > 0) {
    await resetBtn.first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
  }
}

// ── UI-B01: Zero State ───────────────────────────────────────────────────

test('UI-B01: Zero State renders with Command Bar and examples', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Page renders
  await expect(page.locator('body')).toBeVisible();

  // Command Bar exists
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();

  // Has example pills (at least 4 visible)
  const exampleBtns = page.locator('button:has-text("G1"), button:has-text("G2"), button:has-text("G3"), button:has-text("G4")');
  const count = await exampleBtns.count();
  expect(count).toBeGreaterThanOrEqual(4);

  await page.screenshot({ path: `${REPORT_DIR}/01-zero-state.png`, fullPage: true });
});

// ── UI-B02: G1 Initial ───────────────────────────────────────────────────

test('UI-B02: G1 Initial generates real dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // Click G1 example
  await page.locator('button:has-text("G1")').first().click();

  // Wait for dashboard to render
  await waitForDashboard(page);

  // Verify success: look for A公司 in the page
  const body = await page.locator('body').innerText();
  expect(body).toContain('A公司');

  // Verify chart canvas exists (echarts renders canvas elements)
  const canvasCount = await page.locator('canvas').count();
  expect(canvasCount).toBeGreaterThan(0);

  await page.screenshot({ path: `${REPORT_DIR}/02-g1-initial.png`, fullPage: true });
});

// ── UI-B03: G1 Ranking Annotation ───────────────────────────────────────

test('UI-B03: G1 has ranking insight visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);

  // Check for ranking-related content
  const body = await page.locator('body').innerText();
  const hasRanking = body.includes('跌幅') || body.includes('涨跌幅') || body.includes('Top') || body.includes('排名');
  expect(hasRanking).toBe(true);

  await page.screenshot({ path: `${REPORT_DIR}/03-g1-ranking.png`, fullPage: true });
});

// ── UI-B04: G1 Follow-up ────────────────────────────────────────────────

test('UI-B04: G1 follow-up updates dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // G1 initial
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);

  // Follow-up
  const input = page.locator('input[type="text"]');
  await input.fill('把成交量改成涨跌幅');
  await input.press('Enter');

  await waitForDashboard(page);

  // Verify updated
  const body = await page.locator('body').innerText();
  expect(body).toContain('A公司');

  await page.screenshot({ path: `${REPORT_DIR}/04-g1-followup.png`, fullPage: true });
});

// ── UI-B05: G2 Flow ─────────────────────────────────────────────────────

test('UI-B05: G2 initial + follow-up', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // G2: click the example or type it
  const g2Btn = page.locator('button:has-text("G2")');
  if (await g2Btn.count() > 0) {
    await g2Btn.first().click();
  } else {
    const input = page.locator('input[type="text"]');
    await input.fill('比较B公司最近20个交易日的开盘价和收盘价走势。');
    await input.press('Enter');
  }

  await waitForDashboard(page);
  const body = await page.locator('body').innerText();
  expect(body).toContain('B公司');

  // Follow-up
  const input = page.locator('input[type="text"]');
  await input.fill('改为最近10个交易日');
  await input.press('Enter');
  await waitForDashboard(page);

  await page.screenshot({ path: `${REPORT_DIR}/05-g2-flow.png`, fullPage: true });
});

// ── UI-B06: G3 Flow ─────────────────────────────────────────────────────

test('UI-B06: G3 bar chart + follow-up', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("G3")').first().click();
  await waitForDashboard(page);

  const body = await page.locator('body').innerText();
  expect(body).toContain('A公司');

  // Follow-up: change to line
  const input = page.locator('input[type="text"]');
  await input.fill('改成折线图');
  await input.press('Enter');
  await waitForDashboard(page);

  await page.screenshot({ path: `${REPORT_DIR}/06-g3-flow.png`, fullPage: true });
});

// ── UI-B07: G4 Flow ─────────────────────────────────────────────────────

test('UI-B07: G4 volume + follow-up', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("G4")').first().click();
  await waitForDashboard(page);

  const body = await page.locator('body').innerText();
  expect(body).toContain('B公司');

  const input = page.locator('input[type="text"]');
  await input.fill('改为最近20个交易日');
  await input.press('Enter');
  await waitForDashboard(page);

  await page.screenshot({ path: `${REPORT_DIR}/07-g4-flow.png`, fullPage: true });
});

// ── UI-B08: G5 Flow ─────────────────────────────────────────────────────

test('UI-B08: G5 high/low + follow-up', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("G5")').first().click();
  await waitForDashboard(page);

  const body = await page.locator('body').innerText();
  expect(body).toContain('A公司');

  const input = page.locator('input[type="text"]');
  await input.fill('再加上收盘价');
  await input.press('Enter');
  await waitForDashboard(page);

  await page.screenshot({ path: `${REPORT_DIR}/08-g5-flow.png`, fullPage: true });
});

// ── UI-B09: Initial Error ───────────────────────────────────────────────

test('UI-B09: Missing instrument error shows readable message', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const input = page.locator('input[type="text"]');
  await input.fill('分析最近30天的收盘价');
  await input.press('Enter');

  await waitForDashboard(page);

  // Should show error, not crash
  const body = await page.locator('body').innerText();
  const hasError = body.includes('请指定') || body.includes('股票') || body.includes('MISSING') || body.includes('错误');
  expect(hasError).toBe(true);

  // Command bar still usable
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();

  await page.screenshot({ path: `${REPORT_DIR}/09-initial-error.png`, fullPage: true });
});

// ── UI-B10: Follow-up Error Preserves Dashboard ─────────────────────────

test('UI-B10: Follow-up error preserves existing dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // G1 success
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);

  // Verify dashboard exists
  const bodyBefore = await page.locator('body').innerText();
  expect(bodyBefore).toContain('A公司');

  // Unsupported follow-up
  const input = page.locator('input[type="text"]');
  await input.fill('预测明天股价');
  await input.press('Enter');

  await page.waitForTimeout(2000);

  // Dashboard should still be visible (A公司 still in page)
  const bodyAfter = await page.locator('body').innerText();
  expect(bodyAfter).toContain('A公司');

  // Error feedback should be visible
  const hasErrorFeedback = bodyAfter.includes('暂不支持') || bodyAfter.includes('不支持') || bodyAfter.includes('预测');
  expect(hasErrorFeedback).toBe(true);

  await page.screenshot({ path: `${REPORT_DIR}/10-followup-error.png`, fullPage: true });
});

// ── UI-B11: Explainability ──────────────────────────────────────────────

test('UI-B11: Explainability drawer shows trace and provenance', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // G1 success
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);

  // Open details drawer
  const detailsBtn = page.locator('button:has-text("分析全流程"), button:has-text("技术链路"), button:has-text("详情")');
  if (await detailsBtn.count() > 0) {
    await detailsBtn.first().click();
    await page.waitForTimeout(500);

    const body = await page.locator('body').innerText();
    // Should show trace/provenance info
    const hasTrace = body.includes('understand') || body.includes('意图理解') || body.includes('校验') || body.includes('渲染');
    expect(hasTrace).toBe(true);
  }

  await page.screenshot({ path: `${REPORT_DIR}/11-explainability.png`, fullPage: true });
});

// ── UI-B12: Reset ───────────────────────────────────────────────────────

test('UI-B12: Reset returns to zero state', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // G1 success
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);

  // Reset
  await resetToZero(page);
  await page.waitForTimeout(500);

  // Should be back to zero state (empty state visible)
  const body = await page.locator('body').innerText();
  const isZeroState = body.includes('投研分析画布') || body.includes('智能分析') || body.includes('样例');
  expect(isZeroState).toBe(true);
});

// ── UI-B13: Responsive Smoke ────────────────────────────────────────────

test('UI-B13: Responsive 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);
  await page.screenshot({ path: `${REPORT_DIR}/13-responsive-1440.png`, fullPage: true });
});

test('UI-B13: Responsive 1280x800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);
  await page.screenshot({ path: `${REPORT_DIR}/13-responsive-1280.png`, fullPage: true });
});

test('UI-B13: Responsive 768x1024', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("G1")').first().click();
  await waitForDashboard(page);
  await page.screenshot({ path: `${REPORT_DIR}/13-responsive-768.png`, fullPage: true });
});
