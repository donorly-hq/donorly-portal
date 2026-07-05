/**
 * Brand-color contrast guard.
 *
 * Organizations can pick any hex as their primary color, and we paint it
 * behind white text (sidebar, live tally). A pastel pick would make the nav
 * unreadable, so before using an org color as a dark backdrop we verify
 * white text reaches WCAG AA contrast (4.5:1) and darken the color until
 * it does.
 */

const BRAND_FALLBACK = "#083a2e";

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Contrast ratio of white text on the given background color. */
function whiteContrast(rgb: [number, number, number]): number {
  return 1.05 / (relativeLuminance(rgb) + 0.05);
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a background color that white text is readable on. If the given
 * color already passes AA (4.5:1) it is returned unchanged; otherwise it is
 * progressively darkened (hue preserved). Unparseable input returns the
 * brand fallback.
 */
export function readableBrandBg(color: string | null | undefined, fallback: string = BRAND_FALLBACK): string {
  if (!color) return fallback;
  let rgb = parseHex(color);
  if (!rgb) return fallback;
  for (let i = 0; i < 20; i++) {
    if (whiteContrast(rgb) >= 4.5) return toHex(rgb);
    rgb = [rgb[0] * 0.88, rgb[1] * 0.88, rgb[2] * 0.88];
  }
  return fallback;
}
