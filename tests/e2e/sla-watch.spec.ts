import { expect, test, type FrameLocator, type Page } from "@playwright/test";

const appFrame = (page: Page): FrameLocator =>
  page.frameLocator("iframe#app-iframe");

const openWatch = async (page: Page): Promise<FrameLocator> => {
  await page.goto("/ui/apps/my.sla/");
  const app = appFrame(page);

  await expect(app.getByRole("group", { name: "Provider views" })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Coverage" })).toBeVisible();
  await expect(app.getByText("Start setup")).toHaveCount(0);
  return app;
};

const expectNoPageScroll = async (app: FrameLocator) => {
  const dimensions = await app.locator("body").evaluate((body) => ({
    clientHeight: body.clientHeight,
    clientWidth: body.clientWidth,
    scrollHeight: body.scrollHeight,
    scrollWidth: body.scrollWidth,
  }));

  expect(dimensions.scrollHeight).toBeLessThanOrEqual(
    dimensions.clientHeight + 2,
  );
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 2,
  );
};

test.describe("SLA Review deployed smoke", () => {
  test("keeps operating views focused and conservative", async ({
    page,
  }) => {
    const app = await openWatch(page);

    const sectionNavigation = app.getByRole("navigation", {
      name: "Review sections",
    });
    await expect(sectionNavigation.getByRole("link")).toHaveText([
      "Coverage",
      "Performance",
      "Incidents",
      "Evidence",
      "Directory",
    ]);
    await expect(
      sectionNavigation.getByRole("button", { name: /FinOps Agent/i }),
    ).toBeDisabled();
    await expect(sectionNavigation.getByText("Planned")).toBeVisible();
    await expect(
      app.locator(".sla-header").getByRole("link", { name: "Coverage" }),
    ).toHaveCount(0);
    await expect(
      app.locator(".sla-header").getByRole("link", { name: "Directory" }),
    ).toHaveCount(0);

    await expect(
      app.getByRole("button", { name: "Refresh data" }),
    ).toHaveCount(0);
    await expect(app.getByRole("link", { name: "Configure" })).toHaveCount(0);
    await expect(
      app.getByRole("link", { name: "Set up services" }),
    ).toHaveCount(0);
    await expect(
      app.getByRole("link", { name: "Open directory" }),
    ).toHaveCount(0);
    await expect(app.getByRole("link", { name: "Review terms" })).toHaveCount(0);
    await expect(
      app.getByRole("combobox", { name: "Active provider" }),
    ).toHaveCount(0);
    const providerViews = app.getByRole("group", { name: "Provider views" });
    await expect(providerViews.getByRole("button")).toHaveCount(4);
    await expect(providerViews.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(providerViews.locator('button[aria-pressed="true"] img')).toHaveCount(1);
    await expect(
      app
        .getByText(
          /Checking coverage|Access incomplete|Inventory incomplete|Contract unavailable|Action required|Boundary ready|Review available/i,
        )
        .first(),
    ).toBeVisible();
    await expect(
      app.getByText(
        /The provider determines fault, eligibility, and any service credit/i,
      ),
    ).toBeVisible();
    await expect(app.getByRole("heading", { name: "Coverage" })).toBeVisible();
    await expect(app.getByLabel("Coverage status").locator(".overview-fact")).toHaveCount(4);
    await expect(
      app.getByRole("navigation", { name: "Coverage views" }),
    ).toHaveCount(0);
    await expect(app.getByText("Service coverage")).toBeVisible();
    await expect(
      app.getByRole("listbox", { name: "Provider coverage worklist" }),
    ).toBeVisible();
    await expect(
      app.getByRole("searchbox", { name: "Search provider coverage" }),
    ).toBeVisible();
    const coverageViews = app.getByRole("group", {
      name: "Coverage worklist views",
    });
    await expect(coverageViews).toBeVisible();
    const allCoverage = coverageViews.getByRole("button", { name: /^All/ });
    const coveredCoverage = coverageViews.getByRole("button", { name: /^Covered/ });
    const reviewCoverage = coverageViews.getByRole("button", { name: /^Needs review/ });
    await expect(allCoverage).toHaveAttribute("aria-pressed", "true");
    await expect(coveredCoverage).toBeVisible();
    await expect(reviewCoverage).toBeVisible();
    await expect(
      app.getByText(/A confirmed mapping is reused in Incidents/i),
    ).toHaveCount(0);
    await expect(
      app.getByText(/Dynatrace applies provider-native matches/i),
    ).toBeVisible();
    await expect(app.getByRole("link", { name: "Manual coverage" })).toHaveCount(0);
    await expect(app.getByRole("link", { name: "Scope map" })).toHaveCount(0);
    await expect(app.locator(".advisor-count")).toHaveText(/required|recommended|No blockers/i);
    await expect(app.getByText("Reuse coverage outside SLA Review")).toHaveCount(0);
    await expect(app.getByText("Review native SLO coverage next")).toHaveCount(0);
    await expect(app.getByRole("button", { name: "Add custom terms" })).toHaveCount(0);
    await expectNoPageScroll(app);

    const providerScopeText = await app
      .getByLabel("Coverage status")
      .locator(".overview-fact")
      .filter({ hasText: "Provider scope" })
      .innerText();
    const coverageTotals = providerScopeText.match(/(\d[\d,]*) of (\d[\d,]*)/);
    expect(coverageTotals).not.toBeNull();
    await expect(coveredCoverage.locator("strong")).toHaveText(coverageTotals?.[1] ?? "");
    await expect(allCoverage.locator("strong")).toHaveText(coverageTotals?.[2] ?? "");

    await coveredCoverage.click();
    await expect(coveredCoverage).toHaveAttribute("aria-pressed", "true");
    await expect(app.getByText("Customer objective")).toBeVisible();
    await expect(
      app.getByText(/customer-observed availability for one Dynatrace service/i),
    ).toBeVisible();
    await expect(app.getByText("Last 30 days")).toBeVisible();
    await expect(app.getByText(/sla\.directory|tenant override/i)).toBeVisible();

    const createObjective = app.getByRole("button", { name: "Create objective" });
    if (await createObjective.count()) {
      await expect(createObjective).toBeVisible();
      if (await createObjective.isEnabled()) {
        await createObjective.click();
        await expect(
          app.getByText(/Create one Dynatrace objective for this provider and service/i),
        ).toBeVisible();
        await app.getByRole("button", { name: "Cancel" }).click();
        await expect(
          app.getByText(/Create one Dynatrace objective for this provider and service/i),
        ).toHaveCount(0);
      }
    } else {
      await expect(
        app.getByRole("button", { name: "Open in SLOs" }),
      ).toBeVisible();
    }
    await expectNoPageScroll(app);

    await app.getByRole("link", { name: "Performance" }).click();
    await expect(
      app.getByRole("heading", { name: "Performance" }),
    ).toBeVisible();
    await expect(
      app.getByLabel("Performance status").locator(".overview-fact"),
    ).toHaveCount(4);
    const objectiveRegion = app.getByRole("region", {
      name: "Customer objectives",
    });
    const emptyPerformance = app.getByText(/No customer objectives for/);
    await expect(objectiveRegion.or(emptyPerformance)).toBeVisible();
    await expect(app.getByText("Service objectives")).toBeVisible();
    await expect(
      app.getByRole("button", { name: "Open SLOs" }),
    ).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole("link", { name: "Incidents" }).click();
    await expect(app.getByRole("heading", { name: "Incidents" })).toBeVisible();
    const lookback = app.getByRole("combobox", {
      name: "Incident evidence lookback",
    });
    await expect(lookback).toBeVisible();
    await expect(lookback.locator("option")).toHaveCount(7);
    await expect(
      app.getByLabel("Incident status").locator(".overview-fact"),
    ).toHaveCount(4);
    await expect(app.getByText("Needs evidence review", { exact: true })).toBeVisible();
    await expect(app.getByText("Dynatrace Problems", { exact: true })).toBeVisible();
    await expect(
      app.getByRole("button", { name: /Select multiple \(\d+\)/ }),
    ).toBeVisible();
    const openProblems = app.getByRole("button", { name: "Open Problems" });
    await expect(openProblems).toBeVisible();
    await expect(openProblems.locator("svg")).toHaveCount(1);
    const problemsRegion = app.getByRole("region", { name: "Observed Problems" });
    const emptyProblems = app.getByText(/No Problems in the last/);
    await expect(problemsRegion.or(emptyProblems)).toBeVisible();
    if (await problemsRegion.count()) {
      const visibleProblemCount = await problemsRegion.locator(".incident-tile").count();
      expect(visibleProblemCount).toBeGreaterThan(0);
      expect(visibleProblemCount).toBeLessThanOrEqual(8);
      await expect(app.getByLabel("Problem pages")).toBeVisible();
      await expect(
        problemsRegion.locator(".incident-tile-root").first(),
      ).toBeVisible();
    }
    await expect(app.getByRole("combobox", { name: "Provider service" })).toHaveCount(0);
    await expect(app.getByRole("combobox", { name: "Dynatrace scope" })).toHaveCount(0);
    await expect(
      app.getByText(
        /The provider determines fault, eligibility, and any service credit/i,
      ),
    ).toHaveCount(0);
    await expect(
      app.getByText("Filing window reference", { exact: true }),
    ).toHaveCount(0);
    await expect(app.getByText(/maximum credit/i)).toHaveCount(0);
    await expectNoPageScroll(app);

    await app.getByRole("link", { name: "Evidence" }).click();
    await expect(
      app.getByRole("heading", { name: "Evidence" }),
    ).toBeVisible();
    await expect(app.getByRole("link", { name: "Review candidates" })).toHaveClass(/active/);
    await expect(app.getByRole("link", { name: "Provider reports" })).toBeVisible();
    await expect(
      app.getByText(/provider determines fault, eligibility, and any service credit/i),
    ).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole("link", { name: "Provider reports" }).click();
    await expect(app.getByRole("heading", { name: "Provider reports" })).toBeVisible();
    await expect(
      app.getByText(/supporting evidence and does not establish local impact/i),
    ).toBeVisible();
    await expectNoPageScroll(app);

    await sectionNavigation.getByRole("link", { name: "Directory" }).click();
    await expect(
      app.getByRole("heading", { name: /terms/ }),
    ).toBeVisible();
    await expectNoPageScroll(app);
  });

  test("keeps cloud provider credentials outside application settings", async ({
    page,
  }) => {
    const app = await openWatch(page);

    await app.getByRole("button", { name: "Open workspace settings" }).click();
    await expect(
      app.getByRole("heading", { name: "Review defaults." }),
    ).toBeVisible();
    await expect(
      app.getByRole("group", { name: "Providers in scope" }),
    ).toHaveCount(0);
    await expect(
      app.getByRole("checkbox", { name: /Monitor AWS/i }),
    ).toHaveCount(0);
    await expect(app.getByText(/Providers appear automatically/i)).toBeVisible();
    await expect(
      app.getByRole("combobox", { name: "Active provider for focused views" }),
    ).toBeVisible();
    await app.getByRole("link", { name: "Provider connections" }).click();
    await expect(
      app.getByRole("heading", { name: "Connect provider incident data." }),
    ).toBeVisible();
    await expect(
      app.getByText(
        /AWS Health · Azure Service Health · Google Cloud Personalized Service Health · OCI Announcements/i,
      ),
    ).toBeVisible();
    const connectionType = app.getByRole("combobox", {
      name: "Connection type",
    });
    await expect(connectionType).toHaveValue("aws");
    await expect(connectionType.locator("option")).toHaveCount(4);
    await expect(
      app.getByRole("option", { name: "Add a new account" }),
    ).toBeVisible();
    await expect(
      app.getByText(/The Token value must be JSON with/i),
    ).toBeVisible();
    await expect(
      app.getByText(/Published terms work without these connections/i),
    ).toBeVisible();
    await expect(
      app.getByText(/Settings > General > External requests/i),
    ).toBeVisible();
    await expect(
      app.getByRole("button", { name: "Test connection" }),
    ).toBeDisabled();
    await expect(
      app.getByRole("button", { name: "Save connection" }),
    ).toBeDisabled();

    await connectionType.selectOption("azure");
    await expect(
      app.getByRole("textbox", { name: /Azure subscription ID/i }),
    ).toBeVisible();
    await connectionType.selectOption("gcp");
    await expect(
      app.getByRole("textbox", { name: /Google Cloud project ID/i }),
    ).toBeVisible();
    await expect(
      app.getByText(/roles\/serviceusage\.serviceUsageConsumer/i),
    ).toBeVisible();
    await connectionType.selectOption("oci");
    await expect(
      app.getByRole("textbox", { name: /OCI tenancy OCID/i }),
    ).toBeVisible();

    await app.getByRole("link", { name: "Walkthrough" }).click();
    await expect(
      app.getByRole("heading", { name: "Product walkthrough." }),
    ).toBeVisible();
    await expect(
      app.getByText(/walkthrough changes nothing/i),
    ).toBeVisible();
    await expect(app.getByRole("button", { name: "Start walkthrough" })).toBeVisible();
  });

  test("keeps new custom terms in Settings and reserves the modal for edits", async ({
    page,
  }) => {
    const app = await openWatch(page);

    await app
      .getByRole("navigation", { name: "Review sections" })
      .getByRole("link", { name: "Directory" })
      .click();
    await expect(
      app.getByRole("heading", { name: /terms/ }),
    ).toBeVisible();
    await expect(app.getByRole("tab", { name: "Published terms" })).toBeVisible();
    await expect(app.getByRole("tab", { name: /Services/ })).toBeVisible();
    await expect(app.getByRole("tab", { name: "Support" })).toBeVisible();
    await expect(app.getByRole("tab", { name: "Custom terms" })).toBeVisible();
    await expect(app.getByRole("tab", { name: "Scope map" })).toHaveCount(0);
    await expect(
      app.getByRole("heading", { name: "Credit policy" }),
    ).toBeVisible();
    await expect(
      app.getByRole("heading", { name: "How to file" }),
    ).toBeVisible();
    await expectNoPageScroll(app);

    await app.getByRole("tab", { name: /Services/ }).click();
    await expect(
      app.getByRole("searchbox", { name: "Search provider services" }),
    ).toBeVisible();
    await expect(
      app.getByRole("combobox", { name: "Service coverage filter" }),
    ).toBeVisible();
    await app.getByRole("tab", { name: "Support" }).click();
    await expect(
      app.getByText("Separate from availability terms"),
    ).toBeVisible();
    await expect(
      app.getByText(/Not credit-backed|Contractual response target/),
    ).toBeVisible();
    await app.getByRole("tab", { name: "Published terms" }).click();

    await app.getByRole("button", { name: "Add custom terms" }).first().click();
    await expect(
      app.getByRole("heading", { name: /^Add .+ custom terms\.$/ }),
    ).toBeVisible();
    await expect(
      app.getByRole("region", { name: "Add custom terms" }),
    ).toBeVisible();
    await expect(app.getByRole("dialog")).toHaveCount(0);
    await expect(
      app.getByRole("link", { name: "Custom terms" }),
    ).toBeVisible();

    const evidenceBoundary = app.getByRole("combobox", {
      name: /Evidence boundary/i,
    });
    await evidenceBoundary.selectOption("service");
    await expect(app.getByText("No target selected")).toBeVisible();
    const firstTarget = app
      .getByRole("group", { name: "Dynatrace evidence targets" })
      .getByRole("checkbox")
      .first();
    await firstTarget.check();
    await expect(app.getByText("1 exact target")).toBeVisible();
  });

  test("switches themes without losing the compact coverage view", async ({ page }) => {
    const app = await openWatch(page);

    const lightTheme = app.getByRole("button", {
      name: "Switch to light theme",
    });
    const darkTheme = app.getByRole("button", { name: "Switch to dark theme" });

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

    await expect(
      app.getByRole("navigation", { name: "Review sections" })
        .getByRole("link", { name: "Directory" }),
    ).toBeVisible();
    await expectNoPageScroll(app);
  });

  test("renders and explains icon-only header actions", async ({ page }) => {
    const app = await openWatch(page);

    const themeAction = app.getByRole("button", {
      name: /Switch to (light|dark) theme/,
    });
    await expect(themeAction.locator("svg")).toHaveCount(1);
    const themeTooltip = await themeAction.getAttribute("aria-label");
    await themeAction.hover();
    await expect(
      app
        .getByRole("tooltip")
        .filter({ hasText: themeTooltip ?? "Switch theme" }),
    ).toBeVisible();
    await page.mouse.move(0, 100);

    const tooltipCases = [
      { action: "Open workspace settings", tooltip: "Open workspace settings" },
      {
        action: "Start or replay product walkthrough",
        tooltip: "Start or replay walkthrough",
      },
      { action: "Open review guide", tooltip: "Open review guide" },
      { action: "Open change log", tooltip: "Open change log" },
      {
        action: "Dynatrace Community, coming soon",
        tooltip: "Dynatrace Community (coming soon)",
      },
    ];

    for (const { action, tooltip } of tooltipCases) {
      const actionButton = app.getByRole("button", { name: action });
      await expect(actionButton.locator("svg")).toHaveCount(1);
      await actionButton.hover();
      await expect(
        app.getByRole("tooltip").filter({ hasText: tooltip }),
      ).toBeVisible();
      await page.mouse.move(0, 100);
    }
  });

  test("keeps Community destinations disabled before public launch", async ({
    page,
  }) => {
    const app = await openWatch(page);

    await expect(
      app.getByRole("button", { name: "Dynatrace Community, coming soon" }),
    ).toBeDisabled();
    await expect(
      app.getByRole("link", { name: /Dynatrace Community/i }),
    ).toHaveCount(0);

    await app.getByRole("button", { name: "Open review guide" }).click();
    const guide = app.locator('aside[aria-label="Review guide"]');
    await expect(guide).toBeVisible();
    await expect(
      guide.locator(
        '[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]',
      ),
    ).toBeVisible();
    await app.getByRole("button", { name: "Close guide" }).click();

    await app.getByRole("button", { name: "Open change log" }).click();
    await expect(
      app.locator(
        '[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]',
      ),
    ).toBeVisible();
    await expect(
      app.getByRole("link", { name: /Dynatrace Community/i }),
    ).toHaveCount(0);

    await app.getByRole("button", { name: "Open workspace settings" }).click();
    await expect(
      app.locator(
        '[aria-disabled="true"][aria-label="Dynatrace Community, coming soon"]',
      ),
    ).toBeVisible();
    await expect(
      app.getByRole("link", { name: /Dynatrace Community/i }),
    ).toHaveCount(0);
  });
});
