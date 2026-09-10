import { expect, test, type Page } from '@playwright/test';

const openWatch = async (page: Page) => {
  await page.goto('/ui/apps/my.sla/');

  const skipSetup = page.getByRole('button', { name: /skip setup and explore/i });
  if (await skipSetup.isVisible().catch(() => false)) {
    await skipSetup.click();
  }

  const skipWalkthrough = page.getByRole('button', { name: 'Skip' });
  if (await skipWalkthrough.isVisible().catch(() => false)) {
    await skipWalkthrough.click();
  }

  await expect(page.getByRole('link', { name: 'Provider directory' })).toBeVisible();
};

test.describe('SLA Watch deployed smoke', () => {
  test('loads the evidence watch and preserves conservative posture', async ({ page }) => {
    await openWatch(page);

    await expect(page.getByText(/sla\.directory API\s*:/i)).toBeVisible();
    await expect(page.getByText(/Needs labeling|Ready for review|Unavailable|Access incomplete/i)).toBeVisible();
    await expect(page.getByText(/never changes tags, names, or SLOs/i)).toBeVisible();
  });

  test('switches themes without losing the evidence surface', async ({ page }) => {
    await openWatch(page);

    const lightTheme = page.getByRole('button', { name: 'Switch to light theme' });
    const darkTheme = page.getByRole('button', { name: 'Switch to dark theme' });

    if (await lightTheme.isVisible()) {
      await lightTheme.click();
      await expect(darkTheme).toBeVisible();
      await darkTheme.click();
      await expect(lightTheme).toBeVisible();
    } else {
      await expect(darkTheme).toBeVisible();
      await darkTheme.click();
      await expect(lightTheme).toBeVisible();
    }

    await expect(page.getByRole('link', { name: 'Provider directory' })).toBeVisible();
  });
});
