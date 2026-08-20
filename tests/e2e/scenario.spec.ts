import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/portfolio");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("manages a portfolio and completes the interactive release lifecycle", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The complete lifecycle is covered on desktop.",
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await expect(
    page.getByRole("heading", { name: "Data operations portfolio" }),
  ).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(3);

  await page.getByRole("button", { name: "New project" }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create project" });
  await projectDialog.getByLabel("Name").fill("Percussion Artifact Review");
  await projectDialog
    .getByLabel("Summary")
    .fill("Track transient artifacts across generated percussion clips.");
  await projectDialog.getByLabel("Owner").fill("Rae Cole");
  await projectDialog.getByLabel("Modality").fill("music");
  await projectDialog.getByLabel("Budget").fill("2400");
  await projectDialog.getByLabel("Target volume").fill("3600");
  await projectDialog.getByRole("button", { name: "Save project" }).click();
  await expect(
    page.getByRole("heading", { name: "Percussion Artifact Review" }),
  ).toBeVisible();

  const unexpectedCard = page
    .locator(".project-card")
    .filter({ hasText: "Unexpected Vocals" });
  await unexpectedCard.getByRole("link", { name: /Open project/ }).click();
  await expect(page).toHaveURL(/\/projects\/unexpected-vocals\/mission$/);
  await expect(page.getByRole("link", { name: "Mission" })).toHaveClass(
    /active/,
  );

  await page.getByRole("button", { name: "Widgets" }).click();
  await page.getByRole("button", { name: "Hide Target metric" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.locator(".kpi-widget").filter({ hasText: "Target metric" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator(".kpi-widget").filter({ hasText: "Target metric" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Requirements" }).click();
  await page
    .getByLabel("Target behavior")
    .fill(
      "Reduce unexpected vocals below the release threshold for priority slices.",
    );
  await page.getByLabel("Target records").first().fill("5200");
  await page
    .locator('.document-origin-panel input[type="file"]')
    .setInputFiles({
      name: "alignment-notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Alignment notes\nValidate priority slices before pilot v2.",
      ),
    });
  await expect(page.getByText("alignment-notes.md")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  let reminderDialog = page.getByRole("dialog", {
    name: "Create alignment reminder",
  });
  await expect(
    reminderDialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(reminderDialog).toBeHidden();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  reminderDialog = page.getByRole("dialog", {
    name: "Create alignment reminder",
  });
  await reminderDialog.getByLabel("Recipient").fill("Research Systems");
  await reminderDialog.getByLabel("Due date").fill("2026-08-25");
  await reminderDialog
    .getByRole("button", { name: "Create simulated reminder" })
    .click();
  await page
    .getByLabel("Required change reason")
    .fill(
      "Expanded the operating volume and clarified the measurable threshold.",
    );
  await page.getByRole("button", { name: "Publish next version" }).click();
  await expect(page.getByText("Current v4")).toBeVisible();
  await expect(page.getByText("stale", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Save source plan" }).click();

  await page.getByRole("link", { name: "Operations" }).click();
  await page.getByRole("button", { name: "Align", exact: true }).click();
  await expect(
    page.getByText("requirements aligned", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activate" }).click();
  await page.getByRole("button", { name: "Run QA" }).click();
  await expect(
    page.getByText("qa blocked", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjudicate exception" }).click();
  await page.getByRole("button", { name: "Request remediation" }).click();
  await page.getByRole("button", { name: "Load correction" }).click();
  await page.getByRole("button", { name: "Run QA" }).click();
  await expect(page.locator(".gate.fail")).toHaveCount(0);
  await page.getByRole("button", { name: "Sync" }).click();
  await page.getByRole("button", { name: "Import results" }).click();
  await expect(page.getByText("94% QA")).toBeVisible();

  await page.getByRole("link", { name: "Release" }).click();
  await page.getByRole("button", { name: "Build release" }).click();
  await page.getByRole("button", { name: "Create handoff" }).click();
  await page.getByRole("button", { name: /Advance to accepted/ }).click();
  await page.getByRole("button", { name: /Advance to running/ }).click();
  await page.getByLabel("Primary metric result").fill("5.4");
  await page
    .getByLabel("Result notes")
    .fill("Target passed without guardrail regression.");
  await page.getByRole("button", { name: "Submit simulated results" }).click();
  await page.getByRole("button", { name: "Advance to decision ready" }).click();
  await page
    .getByLabel("Decision rationale")
    .fill("All required evaluation evidence and quality gates passed.");
  await page.getByRole("button", { name: "Promote" }).click();
  await expect(
    page.getByText("promoted", { exact: true }).first(),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.reload();
  await expect(
    page.getByText("promoted", { exact: true }).first(),
  ).toBeVisible();
});

test("provides route-aware, overflow-safe mobile navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Mobile behavior is covered by the mobile project.",
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await expect(
    page.getByRole("navigation", { name: "Mobile global navigation" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Mission" })
    .click();
  await expect(page).toHaveURL(/\/projects\/unexpected-vocals\/mission$/);
  await expect(
    page.getByRole("heading", { name: "Unexpected Vocals" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("rejects an unknown project route without changing active context", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Invalid-route behavior is scope-independent.",
  );
  await page.goto("/projects/unknown-project/requirements");
  await expect(
    page.getByText("Project not found", { exact: true }).first(),
  ).toBeVisible();
  const activeProjectId = await page.evaluate(() => {
    const stored = window.localStorage.getItem("signalops-workspace-v2");
    return stored ? JSON.parse(stored).activeProjectId : null;
  });
  expect(activeProjectId).toBe("unexpected-vocals");
});

test("keeps project switching available at tablet widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Tablet behavior is covered from the desktop project.",
  );
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const switcher = page.locator(".mobile-drawer").getByLabel("Active project");
  await expect(switcher).toBeVisible();
  await switcher.selectOption("vocal-naturalness");
  await expect(page).toHaveURL(/\/projects\/vocal-naturalness\/mission$/);
  await expect(
    page.getByRole("heading", { name: "Vocal Naturalness Preference" }),
  ).toBeVisible();
});

test("connects requirements, operations, workflows, and evaluation data", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The connected management flow is covered on desktop.",
  );

  await page.goto("/projects/vocal-naturalness/mission");
  const releasePreset = page.getByRole("button", {
    name: "release readiness",
  });
  await releasePreset.click();
  await expect(releasePreset).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Auto-derived", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Requirements" }).click();
  await expect(page.getByText("Requirement source documents")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await page.getByLabel("Target records").first().fill("7000");
  const savePlan = page.getByRole("button", { name: "Save source plan" });
  await expect(savePlan).toBeEnabled();
  await savePlan.click();
  await expect(
    page.getByText(/Saved in this browser and linked/),
  ).toBeVisible();
  await expect(page.getByText("Vendor scorecard connection")).toBeVisible();

  await page.getByRole("link", { name: "Operations" }).click();
  await expect(page.getByText("Weekly capacity")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "In-house data flow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Quality-control layers" }),
  ).toBeVisible();
  await expect(page.getByText("7,350 accepted records")).toBeVisible();

  await page.getByRole("link", { name: "Workflow" }).click();
  await expect(page.getByText("Pairwise comparison")).toBeVisible();
  await expect(page.locator(".workflow-stage")).toHaveCount(3);

  await page.getByRole("link", { name: "Release" }).click();
  await expect(
    page.getByRole("button", { name: "Download record manifest JSON" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Download complete evaluation package",
    }),
  ).toBeEnabled();
  await expect(
    page.getByText("Record manifest", { exact: true }),
  ).toBeVisible();

  await page.goto("/registry");
  const guideButton = page
    .getByRole("button", { name: "How to connect" })
    .first();
  await guideButton.click();
  await expect(page.getByText("Connection contract").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download connector contract" }).first(),
  ).toBeEnabled();
});
