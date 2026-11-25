import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("homepage compares measured E5, E2 and top-500 outcomes without loading Recharts", async ({ page }) => {
  const assets: string[] = [];
  page.on("request", (request) => assets.push(request.url()));
  await page.goto("/");
  const previews = page.locator(".pub-finding-preview");
  await expect(previews).toHaveCount(3);
  await expect(previews.last().getByText("46", { exact: true })).toBeVisible();
  await expect(previews.last().getByText(/Scale: 0–70/)).toBeVisible();
  expect(assets.some((url) => /\/assets\/charts-/.test(url))).toBe(false);
});

test("model comparison filters and sorts measured results, opens details and exports exact values", async ({ page }) => {
  await page.goto("/experiments/comparison");
  await page.getByLabel("Sort metric").selectOption("low");
  const filter = page.getByRole("group", { name: "Filter compared experiments" });
  await filter.getByRole("button", { name: "E5-A" }).click();
  await expect(filter.getByRole("button", { name: "E5-A" })).toHaveAttribute("aria-pressed", "false");
  const expand = page.getByRole("button", { name: "Expand Average Precision comparison" });
  await expand.click();
  await expect(page.getByRole("dialog", { name: "Average Precision comparison" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
  await page.getByText("Data table and source", { exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("row").nth(1).getByRole("cell").first()).toHaveText("E5-B");
  const ready = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await ready;
  const data = await readFile((await download.path())!, "utf8");
  expect(data).toContain('"Experiment","Average Precision"');
  expect(data).toContain('"E2-D",0.109');
  expect(data).not.toContain('"E5-A"');
  await page.getByText("Confusion matrix · E2-D", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Measured event counts · E2-D" }).getByRole("row", { name: /Original positive 70 100% of row 0/ })).toBeVisible();
  await page.getByLabel("Chart view").selectOption("pr");
  await expect(page.getByRole("heading", { name: "Precision–recall curves" })).toBeVisible();
  await expect(page.locator(".pub-chart-plot .recharts-scatter-symbol").first()).toBeVisible();
});

test("training comparison shows recorded epochs, frequency limits and update provenance", async ({ page }) => {
  await page.goto("/experiments/training");
  await expect(page.getByText(/73\.23% of the original benign training records/)).toBeVisible();
  await expect(page.getByText(/realised draw counts were not saved/)).toBeVisible();
  await page.getByLabel("Training comparison metric").selectOption("completed_updates");
  const update = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Completed optimizer updates by training strategy" }) });
  await update.getByText("Data table and source", { exact: true }).click();
  await expect(update.getByRole("row", { name: /E2-D 25347 recorded/i })).toBeVisible();
  const history = page.locator("figure").filter({ has: page.getByRole("heading", { name: "E2-D training and validation loss" }) });
  await history.getByText("Data table and source", { exact: true }).click();
  await expect(history.getByRole("row")).toHaveCount(498);
  await page.getByLabel("Loss-history run").selectOption("E2-C");
  await expect(page.getByText(/reported checkpoint is epoch 42/)).toBeVisible();
});

test("threshold selector coordinates P99 and exploratory counts with aggregate score charts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/experiments/thresholds");
  await expect(page.getByText("P99 · Primary operating point")).toBeVisible();
  await page.getByLabel("Comparison percentile").selectOption("99.95");
  await expect(page.getByText("P99.95 · Exploratory · retrospective")).toBeVisible();
  await expect(page.getByText("2,339", { exact: true })).toBeVisible();
  await page.getByLabel("Threshold chart").selectOption("distribution");
  await expect(page.locator(".pub-chart-plot .recharts-bar-rectangle").first()).toBeVisible();
  const legend = page.getByRole("group", { name: "Toggle score distributions" });
  await legend.getByRole("button", { name: "Benign test" }).click();
  await expect(legend.getByRole("button", { name: "Benign test" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByLabel("Threshold chart").selectOption("pr");
  await expect(page.getByRole("heading", { name: "Precision versus recall at saved thresholds" })).toBeVisible();
});

test("alert review uses saved cutoffs and ablation exposes ambiguity and token summaries", async ({ page }) => {
  await page.goto("/experiments/alerts");
  await expect(page.getByRole("region", { name: "Alert budget evidence" }).getByText("46 of 70", { exact: true })).toBeVisible();
  const budget = page.getByLabel("Measured alert budget");
  await expect(budget.locator("option")).toHaveCount(8);
  await page.getByRole("button", { name: "Replay review to cutoff" }).click();
  await expect(budget).toHaveValue("50");
  await expect(budget).toHaveValue("500", { timeout: 7000 });
  await expect(page.getByText("46–46", { exact: true })).toBeVisible();
  await page.goto("/experiments/ablation");
  await expect(page.getByText(/70 original positive and 8,393 negatively labelled events/)).toBeVisible();
  await expect(page.getByText("6.76×", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Token-length profile by representation" })).toBeVisible();
  await page.getByLabel("Representation evidence").selectOption("budgets");
  await expect(page.getByRole("heading", { name: "Alert-budget recovery across representations" })).toBeVisible();
});
