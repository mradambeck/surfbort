import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

type Handles = Record<string, { current: { getCurrentTime(): number } | null }>;

/** A player's playback position, read through the handles the playground exposes. */
function currentTime(page: Page, player: string): Promise<number> {
  return page.evaluate(
    (name) => (window as unknown as { __surfbort?: Handles }).__surfbort?.[name]?.current?.getCurrentTime() ?? -1,
    player,
  );
}

/** Waits until the player's first track is loaded and drawn, so input isn't dropped. */
async function ready(player: Locator): Promise<Locator> {
  // Playwright's CSS engine reaches into wavesurfer's open shadow root.
  await expect(player.locator("canvas").first()).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).not.toHaveAttribute("data-loading");
  return player;
}

test("loads without console errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  // Navigate once and never reload: WebKit reports the fetches a reload cancels as errors.
  await page.goto("/");
  await expect(page.locator(".surfbort-waveform")).toHaveCount(7);
  await expect(page.locator(".surfbort-waveform[data-loading]")).toHaveCount(0);
  await expect(page.locator(".surfbort-waveform canvas").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test.describe("with the playground open", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("draws a waveform for the current track", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    const canvas = player.locator("canvas").first();
    expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
  });

  test("plays a track picked from the list", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    await player.getByRole("button", { name: "Play Set Break" }).click();

    await expect(player.getByRole("button", { name: "Pause Set Break" })).toBeVisible();
    await expect(player.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "true");
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.5);
  });

  test("seeks to where the waveform is clicked", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    const slider = player.getByRole("slider", { name: "Seek" });
    await expect(slider).toHaveAttribute("aria-valuemax", "36");

    const box = (await slider.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(16);
    expect(await currentTime(page, "summer")).toBeLessThan(20);
  });

  test("seeks with the arrow keys", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    const slider = player.getByRole("slider", { name: "Seek" });

    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => currentTime(page, "summer")).toBeCloseTo(10, 0);
    await expect(slider).toHaveAttribute("aria-valuetext", "0:10 of 0:36");
  });

  test("moves on to the next track when one ends", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Short Tracks" }));
    await player.getByRole("button", { name: "Play Closeout" }).click();

    await expect(player.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "true", { timeout: 15_000 });
    await expect(player.getByRole("button", { name: "Pause Duck Dive" })).toBeVisible();
    await expect.poll(() => currentTime(page, "short")).toBeGreaterThan(0.2);
  });

  test("pauses the other player when one starts", async ({ page }) => {
    const summer = await ready(page.getByRole("region", { name: "Summer Demos" }));
    const short = await ready(page.getByRole("region", { name: "Short Tracks" }));

    await summer.getByRole("button", { name: "Play", exact: true }).click();
    await expect(summer.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await short.getByRole("button", { name: "Play", exact: true }).click();

    await expect(short.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(summer.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("shows the still background under reduced motion", async ({ page }) => {
    const background = page.getByRole("region", { name: "Summer Demos" }).locator(".surfbort-background img");
    await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain("waves.gif");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain("waves-still.png");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations in the ${colorScheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await expect(page.getByRole("region", { name: "Summer Demos" })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).include(".surfbort").analyze();
      expect(violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`)).toEqual([]);
    });
  }
});
