import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public embedding explorer shows illustrative coordinates and measured counts separately", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 860 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/understand/embedding-explorer");
  await expect(page.getByText(/Teaching sketch · invented coordinates and labels/)).toBeVisible();
  await page.getByLabel("Inspect point").selectOption({ label: "Different copy context" });
  await expect(page.getByText(/3 visible points share these illustrative coordinates/)).toBeVisible();
  await page.getByRole("button", { name: /E5-C · Full provenance/ }).press("Enter");
  await expect(page.getByRole("img", { name: /E5-C illustrative scatter plot/ })).toBeVisible();
  await expect(page.getByLabel("Inspect point")).toHaveValue("illustrative:Different copy context");
  await expect(page.getByText(/21,589 distinct descriptions across 100,892 events/)).toBeVisible();
  await page.getByLabel("Visible labels").selectOption("1");
  await expect(page.getByText("1 of 5 teaching points shown.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load saved embeddings" })).toHaveCount(0);
  expect(requests.some((url) => /\/dataset\/events|embedding-projection\.json/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("dataset lens switches aggregate views and provides exact chronology", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto("/documentation/dataset");
  const lens = page.getByRole("region", { name: "What changes when we add context?" });
  await expect(lens.getByText(/15 \/ 100,892/)).toBeVisible();
  await lens.getByLabel("Text statistic").selectOption("over");
  await expect(lens.getByText(/283 \/ 100,892/)).toBeVisible();
  await lens.getByLabel("Dataset partition").selectOption("train");
  await expect(lens.getByText(/0 of 99,665 events carry an original positive label/)).toBeVisible();
  await page.getByText("Read exact daily event counts").click();
  await expect(page.getByRole("table", { name: "Reconstructed events per UTC day and partition" })).toBeVisible();
});

test("homepage approach cues follow scrolling without opening collapsible details", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const rail = page.getByRole("navigation", { name: "Approach steps" });
  await expect(rail.getByRole("link", { name: /Observe/ })).toBeVisible();
  const summary = page.locator("#approach-3 summary");
  await summary.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - innerHeight * .24));
  await expect(rail.getByRole("link", { name: /Review/ })).toHaveAttribute("aria-current", "step");
  await expect(summary.locator("..")).not.toHaveAttribute("open");
  await expect(page.getByRole("link", { name: "Explore the embedding space" })).toHaveAttribute("href", "/understand/embedding-explorer");
});

for (const [width, colorScheme] of [[320, "dark"], [1440, "light"]] as const) {
  test(`research references are accessible in ${colorScheme} mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/documentation/dataset");
    await page.getByRole("button", { name: "Contextual", exact: true }).press("Enter");
    await expect(page.getByRole("button", { name: "Contextual", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByText("Read exact daily event counts").click();
    const region = page.getByRole("region", { name: "Representation diversity table scroll area" });
    await region.focus();
    await expect(region).toBeFocused();
    if (width === 320) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
    for (const route of ["/documentation/dataset", "/documentation/methodology"]) {
      if (route.endsWith("methodology")) await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });
}
