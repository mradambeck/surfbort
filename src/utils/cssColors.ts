export type ColorOption = "waveColor" | "progressColor" | "cursorColor";

export const COLOR_PROPERTIES: Record<ColorOption, string> = {
  waveColor: "--surfbort-wave-color",
  progressColor: "--surfbort-progress-color",
  cursorColor: "--surfbort-cursor-color",
};

/**
 * Reads the waveform color variables at `el`. Each one is resolved through a hidden
 * probe element, so var() chains and color-mix() arrive at the canvas as plain colors.
 */
export function readWaveformColors(el: HTMLElement): Partial<Record<ColorOption, string>> {
  const style = getComputedStyle(el);
  const probe = el.ownerDocument.createElement("span");
  probe.style.display = "none";
  el.appendChild(probe);

  const colors: Partial<Record<ColorOption, string>> = {};
  for (const [option, property] of Object.entries(COLOR_PROPERTIES) as Array<[ColorOption, string]>) {
    const raw = style.getPropertyValue(property).trim();
    if (!raw) continue;
    probe.style.color = `var(${property})`;
    colors[option] = getComputedStyle(probe).color || raw;
  }

  probe.remove();
  return colors;
}
