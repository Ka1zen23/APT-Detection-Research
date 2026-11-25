import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage roadmap links to connected stages and the E7 plan", async ({ page }) => {
  await page.goto("/");
  const summary = page.getByRole("region", { name: "Research journey summary" });
  await expect(summary.getByText("17 of 27", { exact: true })).toBeVisible();
  await expect(summary.getByText("B6 semantic nearest-neighbour baseline")).toBeVisible();
  await expect(page.getByRole("list", { name: "E7 execution steps" }).locator("li[data-status='planned']")).toHaveCount(5);
  await summary.getByRole("link", { name: "Reproducibility · Next" }).click();
  await expect(page).toHaveURL(/\/progress\?stage=reproducibility/);
  await expect(page.getByRole("button", { name: "Roadmap view" })).toHaveAttribute("aria-pressed", "true");
  const steps = page.getByRole("list", { name: "Research stages" });
  await expect(steps.locator("li[data-status='completed']")).toHaveCount(6);
  await expect(steps.getByRole("button", { name: "Final evaluation and dissertation · Pending" })).toBeVisible();
  await page.getByRole("button", { name: /R18 · E7 multiple-seed reproducibility/ }).click();
  await expect(page.getByText("No supporting artifact is recorded for this milestone.")).toBeVisible();
  await page.getByRole("button", { name: /R17 · Provenance representation ablation/ }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Provenance representation ablation" })).toBeVisible();
  await page.getByRole("button", { name: "Final evaluation and dissertation · Pending" }).click();
  await expect(page.getByRole("button", { name: /R26 · D1 .* In progress/i })).toBeVisible();
  await page.getByRole("button", { name: "Journey view" }).click();
  await expect(page.locator(".pub-journey-list > li")).toHaveCount(10);
});

test("experiment trackers cite completed evidence and do not mark E7 as running", async ({ page }) => {
  await page.goto("/experiments/E5-C");
  const e5 = page.getByRole("list", { name: "E5-C execution steps" });
  await expect(e5.locator("li[data-status='completed']")).toHaveCount(8);
  await e5.getByRole("button", { name: "Autoencoder training · Completed" }).click();
  await expect(page.getByRole("region", { name: "Experiment execution" }).getByText("results/e5c-full-provenance/training_summary.json", { exact: true })).toBeVisible();
  await page.goto("/experiments/E7");
  const e7 = page.getByRole("list", { name: "E7 execution steps" });
  await expect(e7.locator("li[data-status='planned']")).toHaveCount(5);
  await expect(e7.locator("li[data-status='completed'], li[data-status='in_progress']")).toHaveCount(0);
  await e7.getByRole("button", { name: "Repeat training across seeds · Pending" }).click();
  await expect(page.getByText("No output artifact is linked to this step.")).toBeVisible();
});

test("tour tracks explicit reading completion locally and resumes where the visitor left off", async ({ page }) => {
  await page.goto("/understand/apt");
  await page.getByRole("button", { name: "Mark as read" }).click();
  const tracker = page.getByRole("complementary", { name: "Personal reading progress" });
  await expect(tracker.getByRole("progressbar")).toHaveAttribute("value", "1");
  await tracker.getByRole("link", { name: /Chapter 3:/ }).click();
  await expect(tracker.getByText("1 marked read · 11 remaining")).toBeVisible();
  await expect(tracker.getByRole("link", { name: /Chapter 3:/ })).toHaveAttribute("aria-current", "step");
  await page.goto("/understand");
  await page.getByRole("link", { name: "Resume reading" }).click();
  await expect(page).toHaveURL(/\/understand\/system-provenance$/);
  await expect(tracker.getByRole("link", { name: /Chapter 1:.*Marked read/ })).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("17 of 27 milestones completed.", { exact: true })).toBeVisible();
});

test("roadmap is vertical and keyboard accessible with reduced motion on a narrow display", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/progress");
  const steps = page.getByRole("list", { name: "Research stages" });
  const first = steps.getByRole("button", { name: "Research foundation · Completed" });
  const next = steps.getByRole("button", { name: "Reproducibility · Next" });
  await expect(first).toBeVisible();
  expect((await next.boundingBox())!.y).toBeGreaterThan((await first.boundingBox())!.y);
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(next).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, selectors: nodes.map(({ target }) => target) }))).toEqual([]);
});

test("stage status follows milestone records rather than stale next or summary metadata", async ({ page }) => {
  await page.route("**/data/roadmap.json", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.milestones.find(({ id }: { id: string }) => id === "R18").status = "blocked";
    body.data.milestones.find(({ id }: { id: string }) => id === "R19").status = "in_progress";
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  const summary = page.getByRole("region", { name: "Research journey summary" });
  await expect(summary.getByRole("link", { name: "Reproducibility · Blocked" })).toBeVisible();
  await expect(summary.getByRole("link", { name: "Advanced detection · In progress" })).toBeVisible();
  await expect(summary.getByText("Research activity in progress")).toBeVisible();
  await expect(page.getByRole("list", { name: "E7 execution steps" })).toHaveCount(0);
});
