import { expect, test, type FrameLocator, type Page } from '@playwright/test';

const appFrame = (page: Page): FrameLocator => page.frameLocator('iframe#app-iframe');

const openWatch = async (page: Page): Promise<FrameLocator> => {
  await page.goto('/ui/apps/my.sla/');
  const app = appFrame(page);

  const skipSetup = app.getByRole('button', { name: /skip setup and explore/i });
  if (await skipSetup.isVisible().catch(() => false)) {
    await skipSetup.click();
  }

  const skipWalkthrough = app.getByRole('button', { name: 'Skip' });
  if (await skipWalkthrough.isVisible().catch(() => false)) {
    await skipWalkthrough.click();
  }

  await expect(app.getByRole('link', { name: 'Directory' })).toBeVisible();
  return app;
};

const expectNoPageScroll = async (app: FrameLocator) => {
  const dimensions = await app.locator('body').evaluate((body) => ({
    clientHeight: body.clientHeight,
    clientWidth: body.clientWidth,
    scrollHeight: body.scrollHeight,
    scrollWidth: body.scrollWidth,
  }));

  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 2);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
};

test.describe('SLA Watch deployed smoke', () => {
  test('keeps Monitor workspaces focused and conservative', async ({ page }) => {
    const app = await openWatch(page);

    await expect(app.getByRole('button', { name: 'Refresh data' })).toBeVisible();
    await expect(app.getByRole('link', { name: 'Configure' })).toBeVisible();
    await expect(app.getByRole('combobox', { name: 'Active provider' })).toBeVisible();
    await expect(app.getByText(/Needs setup|Needs telemetry|Needs service boundary|Needs mapping|No incident in scope|Candidate|Blocked/i).first()).toBeVisible();
    await expect(app.getByText(/The provider determines fault, eligibility, and any service credit/i)).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole('link', { name: 'Setup' }).click();
    await expect(app.getByRole('heading', { name: 'Setup' })).toBeVisible();
    const setupStages = app.getByRole('list', { name: 'SLA Watch setup stages' });
    await expect(setupStages).toBeVisible();
    await expect(setupStages.getByRole('listitem')).toHaveCount(4);
    await expect(app.getByText(/Service names are not used as proof/i)).toBeVisible();
    await expect(app.getByText(/No tag is added until you select exact services and confirm the change/i)).toBeVisible();
    await app.getByRole('link', { name: 'Scope map' }).click();
    await expect(app.getByText('Service scope map')).toBeVisible();
    await expect(app.getByText(/A confirmed mapping is reused in Incidents/i)).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole('link', { name: 'Incidents' }).click();
    await expect(app.getByRole('heading', { name: 'Incidents' })).toBeVisible();
    const lookback = app.getByRole('combobox', { name: 'Incident evidence lookback' });
    await expect(lookback).toBeVisible();
    await expect(lookback.locator('option')).toHaveCount(7);
    await expect(app.getByText(/The provider determines fault, eligibility, and any service credit/i)).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole('link', { name: 'Provider notices' }).click();
    await expect(app.getByRole('heading', { name: 'Provider notices' })).toBeVisible();
    await expect(app.getByText(/does not prove that a Dynatrace service was affected/i)).toBeVisible();
    await expectNoPageScroll(app);
  });

  test('keeps cloud provider credentials outside application settings', async ({ page }) => {
    const app = await openWatch(page);

    await app.getByRole('button', { name: 'Open monitor settings' }).click();
    await expect(app.getByRole('heading', { name: 'Configure monitor defaults.' })).toBeVisible();
    await expect(app.getByRole('group', { name: 'Monitored providers' })).toBeVisible();
    await expect(app.getByRole('checkbox', { name: /Monitor AWS/i })).toBeVisible();
    await expect(app.getByRole('combobox', { name: 'Active provider for focused views' })).toBeVisible();
    await app.getByRole('link', { name: 'Provider connections' }).click();
    await expect(app.getByRole('heading', { name: 'Connect provider incident data.' })).toBeVisible();
    await expect(app.getByText(/AWS Health · Azure Service Health · Google Cloud Personalized Service Health · OCI Announcements/i)).toBeVisible();
    await expect(app.getByRole('combobox', { name: 'Connection type' })).toHaveValue('aws');
    await expect(app.getByRole('option', { name: 'Add a new account' })).toBeVisible();
    await expect(app.getByText(/The Token value must be JSON with/i)).toBeVisible();
    await expect(app.getByText(/no provider notice proves local impact or SLA eligibility/i)).toBeVisible();
  });

  test('keeps new SLA setup in Settings and reserves the modal for edits', async ({ page }) => {
    const app = await openWatch(page);

    await app.getByRole('link', { name: 'Directory' }).click();
    await expect(app.getByRole('heading', { name: 'Directory' })).toBeVisible();
    await expect(app.getByRole('heading', { name: 'Vendor' })).toBeVisible();
    await expect(app.getByRole('tab', { name: 'SLA overrides' })).toBeVisible();
    await expect(app.getByRole('tab', { name: 'Scope map' })).toHaveCount(0);
    await expectNoPageScroll(app);

    await app.getByRole('button', { name: 'Add SLA override' }).first().click();
    await expect(app.getByRole('heading', { name: 'Add a custom SLA.' })).toBeVisible();
    await expect(app.getByRole('region', { name: 'Add SLA override' })).toBeVisible();
    await expect(app.getByRole('dialog')).toHaveCount(0);
    await expect(app.getByRole('link', { name: 'SLA overrides' })).toBeVisible();

    const evidenceBoundary = app.getByRole('combobox', { name: /Evidence boundary/i });
    await evidenceBoundary.selectOption('service');
    await expect(app.getByText('No target selected')).toBeVisible();
    const firstTarget = app.getByRole('group', { name: 'Dynatrace evidence targets' }).getByRole('checkbox').first();
    await firstTarget.check();
    await expect(app.getByText('1 exact target')).toBeVisible();
  });

  test('switches themes without losing the compact watch', async ({ page }) => {
    const app = await openWatch(page);

    const lightTheme = app.getByRole('button', { name: 'Switch to light theme' });
    const darkTheme = app.getByRole('button', { name: 'Switch to dark theme' });

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

    await expect(app.getByRole('link', { name: 'Directory' })).toBeVisible();
    await expectNoPageScroll(app);
  });

  test('renders and explains icon-only header actions', async ({ page }) => {
    const app = await openWatch(page);

    const themeAction = app.getByRole('button', { name: /Switch to (light|dark) theme/ });
    await expect(themeAction.locator('svg')).toHaveCount(1);
    const themeTooltip = await themeAction.getAttribute('aria-label');
    await themeAction.hover();
    await expect(app.getByRole('tooltip').filter({ hasText: themeTooltip ?? 'Switch theme' })).toBeVisible();
    await page.mouse.move(0, 100);

    const tooltipCases = [
      { action: 'Open monitor settings', tooltip: 'Open monitor settings' },
      { action: 'Start or replay SLA Watch walkthrough', tooltip: 'Start or replay walkthrough' },
      { action: 'Open SLA Watch guide', tooltip: 'Open SLA Watch guide' },
      { action: 'Open change log', tooltip: 'Open change log' },
      { action: 'Dynatrace Community, coming soon', tooltip: 'Dynatrace Community (coming soon)' },
    ];

    for (const { action, tooltip } of tooltipCases) {
      const actionButton = app.getByRole('button', { name: action });
      await expect(actionButton.locator('svg')).toHaveCount(1);
      await actionButton.hover();
      await expect(app.getByRole('tooltip').filter({ hasText: tooltip })).toBeVisible();
      await page.mouse.move(0, 100);
    }
  });

  test('keeps Community destinations disabled before public launch', async ({ page }) => {
    const app = await openWatch(page);

    await expect(app.getByRole('button', { name: 'Dynatrace Community, coming soon' })).toBeDisabled();
    await expect(app.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);

    await app.getByRole('button', { name: 'Open SLA Watch guide' }).click();
    const guide = app.locator('aside[aria-label="SLA Watch guide"]');
    await expect(guide).toBeVisible();
    await expect(guide.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await app.getByRole('button', { name: 'Close guide' }).click();

    await app.getByRole('button', { name: 'Open change log' }).click();
    await expect(app.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await expect(app.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);

    await app.getByRole('button', { name: 'Open monitor settings' }).click();
    await expect(app.locator('[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]')).toBeVisible();
    await expect(app.getByRole('link', { name: /Dynatrace Community/i })).toHaveCount(0);
  });
});
