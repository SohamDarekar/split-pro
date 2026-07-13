export const ACCENT_COLORS = [
  'default',
  'blue',
  'purple',
  'lime',
  'red',
  'orange',
  'yellow',
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = 'default';

export function isAccentColor(value: string): value is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(value);
}

// Swatch shown in the picker UI, mirrors the --primary override in globals.css. Each hex is the real iOS system-app icon color it's named after.
export const ACCENT_COLOR_SWATCH_CLASS: Record<AccentColor, string> = {
  default: 'bg-cyan-500',
  blue: 'bg-[#0a84ff]', // Mail
  purple: 'bg-[#b150e2]', // Podcasts
  lime: 'bg-[#92e82a]', // Fitness
  red: 'bg-[#fa233b]', // Music
  orange: 'bg-[#ff9500]', // Watch
  yellow: 'bg-[#ffd52e]', // Notes
};
