import { expect, test, type Locator, type Page } from "@playwright/test";
import { currentTime, seek } from "./helpers";

/** Records the path of every audio file the page requests, with the response status once it arrives. */
function recordAudio(page: Page): Array<{ path: string; status?: number }> {
  const requests: Array<{ path: string; status?: number }> = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.endsWith(".wav")) requests.push({ path: pathname });
  });
  page.on("response", (response) => {
    const { pathname } = new URL(response.url());
    const request = requests.find((entry) => entry.path === pathname && entry.status === undefined);
    if (request) request.status = response.status();
  });
  return requests;
}

/** Gives anything the page would fetch on its own time to start. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

/** How many pixels the player's waveform canvases have painted. */
function paintedPixels(player: Locator): Promise<number> {
  return player.locator(".surfbort-waveform canvas").evaluateAll((canvases: HTMLCanvasElement[]) =>
    canvases.reduce((total, canvas) => {
      if (!canvas.width || !canvas.height) return total;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
      return total + painted;
    }, 0),
  );
}

test.describe('preload="none"', () => {
  test("makes no audio requests until play, with or without peaks", async ({ page }) => {
    const audio = recordAudio(page);
    await page.goto("/?demo=lazy");
    const player = page.getByRole("region", { name: "Night Swim" });
    const slider = player.getByRole("slider", { name: "Seek" });
    const tracks = player.getByRole("listitem");

    // Low Tide has no peaks: an empty waveform, no progress bar, and its length from `duration`.
    await expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 0:36");
    await settle(page);
    expect(audio).toEqual([]);
    await expect(slider).not.toHaveAttribute("data-loading");
    expect(await paintedPixels(player)).toBe(0);

    // Set Break has peaks, so its waveform draws without a request.
    await player.getByRole("button", { name: "Next track" }).click();
    await expect(tracks.nth(1)).toHaveAttribute("aria-current", "true");
    await expect.poll(() => paintedPixels(player)).toBeGreaterThan(0);
    // Offshore has neither peaks nor a duration.
    await player.getByRole("button", { name: "Next track" }).click();
    await expect(tracks.nth(2)).toHaveAttribute("aria-current", "true");
    await settle(page);
    expect(audio).toEqual([]);

    await player.getByRole("button", { name: "Play Set Break" }).click();
    await expect(player.getByRole("button", { name: "Pause Set Break" })).toBeVisible();
    await expect.poll(() => currentTime(page, "lazy")).toBeGreaterThan(0.5);
    expect(audio.length).toBeGreaterThan(0);
    expect(new Set(audio.map((request) => request.path))).toEqual(new Set(["/demo/set-break.wav"]));
  });

  test("shows the still background until play, then fetches and plays the GIF", async ({ page }) => {
    const gifs: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith(".gif")) gifs.push(request.url());
    });
    await page.goto("/?demo=lazy");
    const player = page.getByRole("region", { name: "Night Swim" });
    const animation = player.locator(".surfbort-background-animation");
    await expect(player.locator(".surfbort-background img").first()).toHaveAttribute("src", "/demo/waves-still.png");
    await settle(page);
    expect(gifs).toEqual([]);

    await player.getByRole("button", { name: "Play Set Break" }).click();
    await expect(animation).toBeVisible();
    expect(gifs).toHaveLength(1);

    await player.getByRole("button", { name: "Pause Set Break" }).click();
    await expect(animation).toBeHidden();
  });

  test("downloads a track without peaks when it's played, without shifting the layout", async ({ page }) => {
    const audio = recordAudio(page);
    await page.goto("/?demo=lazy");
    const player = page.getByRole("region", { name: "Night Swim" });
    const slider = player.getByRole("slider", { name: "Seek" });
    await expect(slider).toBeVisible();
    await settle(page);
    const before = (await player.boundingBox())!;

    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => currentTime(page, "lazy")).toBeGreaterThan(0.5);
    await expect.poll(() => paintedPixels(player)).toBeGreaterThan(0);
    await expect(slider).not.toHaveAttribute("data-loading");
    expect(audio.map((request) => request.path)).toContain("/demo/low-tide.wav");
    expect((await player.boundingBox())!.height).toBe(before.height);

    // It plays from the downloaded copy, so a seek lands.
    await seek(page, "lazy", 20);
    await expect.poll(() => currentTime(page, "lazy")).toBeGreaterThan(20);
  });
});

test.describe("streaming={false}", () => {
  test("downloads a track on play and seeks on a host without byte ranges", async ({ page }) => {
    const audio = recordAudio(page);
    await page.goto("/?demo=no-range");
    const player = page.getByRole("region", { name: "Static Host" });

    // The peaks draw before anything downloads.
    await expect.poll(() => paintedPixels(player)).toBeGreaterThan(0);
    await settle(page);
    expect(audio).toEqual([]);

    await player.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => currentTime(page, "noRange")).toBeGreaterThan(0.2);
    expect(audio).toEqual([{ path: "/no-range/demo/set-break.wav", status: 200 }]);

    await seek(page, "noRange", 20);
    await expect.poll(() => currentTime(page, "noRange")).toBeGreaterThan(20);
    // A seek the server can't serve snaps back to the start, so check it held.
    await page.waitForTimeout(500);
    expect(await currentTime(page, "noRange")).toBeGreaterThan(20);
    expect(audio).toHaveLength(1);
  });
});
