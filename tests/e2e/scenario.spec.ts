import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("runs the blocked delivery through promotion and persists the decision", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "The complete workflow is covered on desktop.");

  await expect(page.getByRole("heading", { name: /Turn noisy signals into trusted data/i })).toBeVisible();
  await expect(page.getByText("signal detected", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Align stale artifacts" }).click();
  await page.getByRole("button", { name: "Capture signal" }).click();
  await page.getByRole("button", { name: "Activate all sources" }).click();
  await page.getByRole("button", { name: "Run automated QA" }).click();

  await expect(page.getByText("qa blocked", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Inter-rater disagreement", { exact: true })).toBeVisible();
  await expect(page.locator(".gate.fail")).toHaveCount(7);

  await page.getByRole("button", { name: /delivery-009/ }).click();
  await page.getByLabel("Required rationale").fill("Ambiguous vocal-like harmonic requires expert review.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await page.getByRole("button", { name: /Send remediation/ }).click();
  await page.getByRole("button", { name: "Load corrected delivery" }).click();
  await page.getByRole("button", { name: "Run automated QA" }).click();

  await expect(page.locator(".gate.fail")).toHaveCount(0);
  await expect(page.getByText("Corrected delivery passed all critical gates.")).toBeVisible();

  for (let index = 1; index <= 7; index += 1) {
    await page.getByRole("combobox", { name: "Classification", exact: true }).selectOption(index === 1 || index === 4 || index === 7 ? "vocals_present" : "instrumental");
    const notes = page.getByLabel("Expert notes");
    await notes.fill(`Audible evidence reviewed against rubric v3 for task ${index}.`);
    await page.getByRole("button", { name: "Submit annotation" }).click();
  }

  await expect(page.getByText("7/7 complete · 2 reviewers")).toBeVisible();
  await page.getByRole("button", { name: "Build release" }).click();
  await expect(page.locator("#release").getByText("dataset-v4", { exact: true })).toBeVisible();

  await page.getByLabel("Release rationale").fill("Target slice clears the threshold while prompt-adherence guardrails remain stable.");
  await page.getByRole("button", { name: "Promote dataset" }).click();
  await expect(page.getByText("promoted", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Export decision package" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("promoted", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("signal detected", { exact: true }).first()).toBeVisible();
});

test("adapts the control plane for mobile navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile layout is covered on the mobile project.");

  await expect(page.getByRole("navigation", { name: "Mobile workspace sections" })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Turn noisy signals into trusted data/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
