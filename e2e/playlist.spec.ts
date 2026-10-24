import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { currentTime, events, ready, seek } from "./helpers";

test("loads without console errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  // Navigate once and never reload: WebKit reports the fetches a reload cancels as errors.
  await page.goto("/");
  await expect(page.locator(".surfbort-waveform")).toHaveCount(9);
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
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.2);

    // Skip to the last second of Low Tide instead of waiting out all 36.
    await seek(page, "summer", 35);
    await expect(player.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
    expect(await events(page)).toEqual(["trackEnd:Low Tide"]);
    await expect(player.getByRole("button", { name: "Pause Set Break" })).toBeVisible();
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.2);
  });

  test("stops at the end on End instead of moving on", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.2);

    await player.getByRole("slider", { name: "Seek" }).focus();
    await page.keyboard.press("End");
    await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(35.9);
    // Give an auto-advance time to show itself.
    await page.waitForTimeout(1000);
    await expect(player.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
    expect(await currentTime(page, "summer")).toBeGreaterThan(35.9);
    expect(await events(page)).toEqual([]);

    // Playing again starts the track over.
    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect(player.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect.poll(() => currentTime(page, "summer")).toBeLessThan(5);
    await expect(player.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
  });

  for (const [key, landsAt] of [["ArrowLeft", 31], ["Home", 0]] as const) {
    test(`stays on the track when End is followed at once by ${key}`, async ({ page }) => {
      const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
      await player.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.2);

      const slider = player.getByRole("slider", { name: "Seek" });
      await slider.focus();
      // Both keys in one call, so the second arrives before the media finishes the first seek.
      await slider.evaluate((el, second) => {
        for (const key of ["End", second]) el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }, key);

      await page.waitForTimeout(1000);
      await expect(player.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
      await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      expect(await currentTime(page, "summer")).toBeCloseTo(landsAt, 0);
      expect(await events(page)).toEqual([]);
    });
  }

  test("stops at the end when the waveform is dragged past it", async ({ page }) => {
    const player = await ready(page.getByRole("region", { name: "Summer Demos" }));
    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => currentTime(page, "summer")).toBeGreaterThan(0.2);

    const box = (await player.getByRole("slider", { name: "Seek" }).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    // Past wavesurfer's drag threshold, then on past the edge once that seek lands. A burst of
    // drag seeks can land out of order in WebKit, which is wavesurfer's to sort out.
    await page.mouse.move(box.x + box.width / 2 + 10, y);
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + box.width + 40, y);
    await page.mouse.up();

    await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(player.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "true");
    expect(await currentTime(page, "summer")).toBeGreaterThan(35.9);
    expect(await events(page)).toEqual([]);
  });

  test("pauses the other player when one starts", async ({ page }) => {
    const summer = await ready(page.getByRole("region", { name: "Summer Demos" }));
    const sunset = await ready(page.getByRole("region", { name: "Sunset Session" }));

    await summer.getByRole("button", { name: "Play", exact: true }).click();
    await expect(summer.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await sunset.getByRole("button", { name: "Play", exact: true }).click();

    await expect(sunset.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(summer.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("shows the still background under reduced motion", async ({ page }) => {
    const background = page.getByRole("region", { name: "Summer Demos" }).locator(".surfbort-background img");
    await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain("waves.gif");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain("waves-still.png");
  });

  test("scrolls a capped player's track list to the current track", async ({ page }) => {
    const player = page.getByRole("region", { name: "Long Set" });
    const list = player.getByRole("list", { name: "Tracks" });
    await player.scrollIntoViewIfNeeded();
    expect((await player.boundingBox())!.height).toBeLessThanOrEqual(460);
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    const pageScroll = await page.evaluate(() => window.scrollY);
    const next = player.getByRole("button", { name: "Next track" });
    for (let i = 0; i < 7; i++) await next.click();
    await expect(player.getByRole("listitem").nth(7)).toHaveAttribute("aria-current", "true");
    await expect.poll(() => list.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)).toBe(true);
    await expect(player.getByRole("listitem").nth(7)).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
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
