export const ACCENT_COLORS = [
  'default',
  'blue',
  'purple',
  'lime',
  'red',
  'orange',
  'pink',
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = 'default';

export function isAccentColor(value: string): value is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(value);
}

// Swatch shown in the picker UI, mirrors the --primary override for each `data-accent` value in globals.css.
export const ACCENT_COLOR_SWATCH_CLASS: Record<AccentColor, string> = {
  default: 'bg-cyan-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  lime: 'bg-lime-500',
  red: 'bg-[#fa233b]',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
};
