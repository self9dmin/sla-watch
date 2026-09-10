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
    await expect(page.getByText(/Needs labeling|Needs telemetry|Needs service boundary|Needs mapping|No incident in scope|Candidate|Blocked/i).first()).toBeVisible();
    await expect(page.getByText(/The provider determines fault, eligibility, and any service credit/i)).toBeVisible();

    await page.getByRole('link', { name: 'Evidence' }).click();
    await expect(page.getByRole('heading', { name: 'Evidence required for provider attribution' })).toBeVisible();
    const evidenceStages = page.getByRole('list', { name: 'Provider attribution evidence stages' });
    await expect(evidenceStages).toBeVisible();
    await expect(evidenceStages.getByRole('listitem')).toHaveCount(4);
    await expect(page.getByText(/does not change tags, names, or SLOs/i)).toBeVisible();
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

  test('keeps Community destinations disabled before public launch', async ({ page }) => {
    await openWatch(page);

    await expect(page.getByRole('button', { name: 'Dynatrace Community, coming soon' })).toBeDisabled();
    await expect(page.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open SLA Watch guide' }).click();
    const guide = page.locator('aside[aria-label="SLA Watch guide"]');
    await expect(guide).toBeVisible();
    await expect(guide.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await page.getByRole('button', { name: 'Close guide' }).click();

    await page.getByRole('button', { name: 'Open change log' }).click();
    await expect(page.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);
  });
});
