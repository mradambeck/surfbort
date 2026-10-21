import { expect, type Locator, type Page } from "@playwright/test";

type Handles = Record<string, { current: { getCurrentTime(): number; seek(seconds: number): void } | null }>;

/** A player's playback position, read through the handles the playground exposes. */
export function currentTime(page: Page, player: string): Promise<number> {
  return page.evaluate(
    (name) => (window as unknown as { __surfbort?: Handles }).__surfbort?.[name]?.current?.getCurrentTime() ?? -1,
    player,
  );
}

export function seek(page: Page, player: string, seconds: number): Promise<void> {
  return page.evaluate(
    ([name, to]) => (window as unknown as { __surfbort?: Handles }).__surfbort?.[name]?.current?.seek(to),
    [player, seconds] as const,
  );
}

/** Callbacks the playground's players have fired, like "trackEnd:Low Tide". */
export function events(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __surfbortEvents?: string[] }).__surfbortEvents ?? []);
}

/** Waits until the player's first track is loaded and drawn, so input isn't dropped. */
export async function ready(player: Locator): Promise<Locator> {
  // Playwright's CSS engine reaches into wavesurfer's open shadow root. A track without peaks
  // downloads and decodes first, which can take a while with every browser running at once.
  await expect(player.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  await expect(player.getByRole("slider", { name: "Seek" })).not.toHaveAttribute("data-loading");
  return player;
}
