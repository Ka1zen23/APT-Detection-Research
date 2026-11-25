import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] } });

test("pipeline supports stage inspection, playback and a distinct planned branch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/understand/pipeline");
  const stages = page.getByRole("list", { name: "Pipeline stages" });
  await expect(stages.getByRole("button")).toHaveCount(13);
  const detail = page.getByRole("region", { name: "Selected pipeline stage" });
  await stages.getByRole("button", { name: /Calibration/ }).click();
  await expect(detail.getByRole("heading", { name: "Threshold calibration" })).toBeVisible();
  await expect(detail.getByText(/separate benign validation set/)).toBeVisible();
  await expect(detail.getByText(/saved P99 cutoff/)).toBeVisible();
  await stages.getByRole("button", { name: /Incidents Planned/ }).click();
  await expect(detail.getByText(/Planned · not evaluated/)).toBeVisible();
  await expect(detail.getByText(/not a verified incident timeline/)).toBeVisible();
  const playback = page.getByRole("group", { name: "Pipeline playback" });
  await playback.getByRole("button", { name: "Replay" }).click();
  await expect(detail.getByRole("heading", { name: "Raw provenance records" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Graph construction" })).toBeVisible();
  await playback.getByRole("button", { name: "Pause" }).click();
  await expect(playback.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("autoencoder playback labels the real layer sizes and toy reconstruction", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/understand/autoencoder");
  await page.getByRole("button", { name: "Positively annotated example" }).click();
  await page.getByLabel("Animation speed").selectOption("2");
  await page.getByRole("button", { name: "Run inference demo" }).click();
  await expect(page.getByText("Bottleneck · 32 units.")).toBeVisible();
  await page.getByRole("button", { name: "5. Reconstructed output" }).click();
  await expect(page.getByText(/Toy mean squared error/)).toBeVisible();
  await expect(page.getByText(/No model inference is performed/)).toBeVisible();
  await expect(page.getByRole("table", { name: /six toy values/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("public graph keeps 3D opt-in and provides a usable fallback without WebGL", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.assign(HTMLCanvasElement.prototype, {
      getContext: function (kind: string, ...args: unknown[]) {
        return kind === "webgl2" ? null : Reflect.apply(original, this, [kind, ...args]);
      },
    });
  });
  await page.goto("/understand/provenance-explorer");
  await expect(page.getByRole("img", { name: /Two-dimensional provenance graph/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Local dataset mode" })).toBeDisabled();
  await page.getByLabel("Inspect relationship").selectOption("3");
  await expect(page.getByRole("region", { name: "Directed relationship inspector" }).getByText("WasGeneratedBy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open 3D view" }).click();
  await expect(page.getByText(/WebGL 2 is unavailable/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Two-dimensional provenance graph/ })).toBeVisible();
  expect(requests.some((url) => /ProvenanceScene-|three-(core|renderer)-|\/dataset\/events/.test(url))).toBe(false);
});

test.describe("3D provenance", () => {
  test("loads the renderer on demand and supports keyboard camera controls", async ({ page }) => {
    await page.goto("/understand/provenance-explorer");
    const available = await page.evaluate(() => {
      const context = document.createElement("canvas").getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    });
    test.skip(!available, "WebGL 2 is not supported by this browser runner");
    await page.getByRole("button", { name: "Open 3D view" }).click();
    await expect(page.locator(".pub-provenance-canvas canvas")).toBeVisible();
    await page.getByLabel("Inspect node").selectOption("A1");
    const controls = page.getByRole("group", { name: "3D camera controls" });
    for (const name of ["Rotate", "Pan right", "Zoom in", "Focus selected node", "Reset camera"]) {
      await controls.getByRole("button", { name, exact: true }).press("Enter");
    }
    await expect(page.getByText("Selected: Project file.")).toBeVisible();
    await page.getByRole("button", { name: "2D graph" }).click();
    await expect(page.locator(".pub-provenance-canvas")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Two-dimensional provenance graph/ })).toBeVisible();
  });
});

test("representation transformation keeps teaching labels and measured E5 evidence separate", async ({ page }) => {
  await page.goto("/understand/event-descriptions");
  await expect(page.getByText("Read → Copy", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: /With entity attributes/ }).click();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await expect(page.getByText(/process: Unfamiliar process/)).toBeVisible();
  await page.getByRole("button", { name: /Full provenance/ }).click();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page.locator(".pub-transform-entity")).toHaveCount(6);
  await expect(page.getByText("0.021743", { exact: true })).toBeVisible();
  await expect(page.getByText(/70 originally positive and 8,393 negatively labelled events/)).toBeVisible();
});
