import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage teaches the question and traces the three evidence claims", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Can artificial intelligence recognise a cyberattack it has never seen before/);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveCount(6);
  await expect(page.getByText("6.76×", { exact: true })).toBeVisible();
  await expect(page.getByText("5.24×", { exact: true })).toBeVisible();
  await expect(page.getByText("46 of 70", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unusual activity" }).click();
  await expect(page.getByRole("button", { name: "Unusual activity" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /does not prove an attack/ })).toBeVisible();
  await page.getByRole("link", { name: "Explore the Research" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Understand the research" })).toBeVisible();
  await expect(page.locator(".pub-tour-index li")).toHaveCount(12);
});

test("tour differentiates simulations, measured evidence and calculated examples", async ({ page }) => {
  await page.goto("/understand/system-provenance");
  await expect(page.getByText("Read → Copy", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Full provenance" }).click();
  await expect(page.getByText("0.021743", { exact: true })).toBeVisible();
  await page.getByText("See the example supplied with the evidence").click();
  await expect(page.getByText(/Illustrative redacted event/)).toBeVisible();
  await page.getByRole("link", { name: "Next chapter" }).click();
  await expect(page.getByText("70 of 100,892")).toBeVisible();
  await page.getByRole("button", { name: "Try an always-negative prediction" }).click();
  await expect(page.getByText("zero positives detected")).toBeVisible();

  await page.goto("/understand/autoencoder");
  await page.getByRole("button", { name: "4. Reconstruction" }).click();
  await page.getByRole("button", { name: "Unfamiliar pattern" }).click();
  await expect(page.getByText(/unusual does not mean malicious/)).toBeVisible();
  await page.goto("/understand/embeddings");
  await page.getByLabel("Choose an input description").selectOption("1");
  await expect(page.getByText("A program connects to a remote service.")).toBeVisible();

  await page.goto("/understand/anomaly-detection");
  const threshold = page.getByRole("slider");
  await threshold.focus();
  await threshold.press("End");
  await expect(page.getByText("0 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Measured E2-D results" }).click();
  await page.getByLabel("Saved validation percentile").selectOption("99.95");
  await expect(page.getByText(/2,339 false positives/)).toBeVisible();
  await expect(page.getByText(/examined retrospectively/)).toBeVisible();
  await page.getByRole("link", { name: "Next chapter" }).click();
  await expect(page.getByText("46 of 70", { exact: true })).toBeVisible();
  await page.getByLabel("Alerts reviewed").selectOption("100");
  await expect(page.getByText("16 of 70", { exact: true })).toBeVisible();
});

test("technical view persists and preserves configurations, comparisons and legacy links", async ({ page }) => {
  await page.goto("/experiments/E2-D");
  await expect(page.getByRole("button", { name: "Guided view" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Technical view" }).click();
  await page.getByRole("tab", { name: "Configuration", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByText("Training configuration", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Compare models", exact: true }).click();
  await expect(page.getByRole("button", { name: "Technical view" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Choose a comparison metric").selectOption("recall");
  await expect(page.getByRole("figure").getByText(/annotated positives flagged/)).toBeVisible();
  await page.getByRole("tab", { name: "ROC / PR curves" }).click();
  await expect(page.getByText(/intermediate values are not estimated/)).toBeVisible();
  await expect(page.locator(".recharts-scatter-symbol").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Technical view" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/experiments\/evidence$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/journal/2026-11-25");
  await expect(page).toHaveURL(/\/documentation\/journal\/2026-11-25$/);
});

test("findings, progress, and documentation retain source and availability information", async ({ page, request }) => {
  await page.goto("/findings#F05");
  const finding = page.locator("#F05");
  await expect(finding).toBeInViewport();
  await finding.getByText("Interpretation and limitations").click();
  await expect(finding.getByText(/does not isolate the causal contribution/).first()).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText(/preparing the E7 multiple-seed/)).toBeVisible();
  await expect(page.getByText(/Not yet executed/)).toBeVisible();
  await expect(page.locator(".pub-progress-list > li")).toHaveCount(10);
  await page.goto("/documentation/artifacts");
  const figure = page.locator("a[href*='/artifacts/figures/']").first();
  const document = page.locator("a[href*='/artifacts/documents/']").first();
  await expect(figure).toBeVisible();
  await expect(document).toBeVisible();
  expect((await request.get((await figure.getAttribute("href"))!)).ok()).toBe(true);
  expect((await request.get((await document.getAttribute("href"))!)).ok()).toBe(true);
  await page.getByRole("combobox", { name: "Experiment", exact: true }).selectOption("E7");
  await expect(page.getByText(/0 public figures for E7/)).toBeVisible();
});

test("mobile keyboard navigation and theme work without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Overview" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/", "/understand/anomaly-detection", "/findings", "/experiments/E2-D", "/progress"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("narrow layouts and missing evidence do not show invented results", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  for (const route of ["/understand/embeddings", "/documentation/artifacts"]) {
    await page.goto(route);
    await expect(page.locator("select").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.route("**/data/comparisons/ablation.json", async (route) => {
    await route.fulfill({ status: 404, body: "Unavailable" });
  });
  await page.goto("/findings#F05");
  await expect(page.locator("#F05").getByText("Measured values are not available here.")).toBeVisible();
  await expect(page.locator("#F05 .pub-evidence li")).toHaveCount(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`public reading surfaces pass automated WCAG checks in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const route of ["/", "/understand/anomaly-detection", "/findings"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((item) => ({ rule: item.id, elements: item.nodes.map((node) => node.target) }))).toEqual([]);
    }
  });
}
