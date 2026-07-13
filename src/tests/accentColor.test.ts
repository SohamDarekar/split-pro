import {
  ACCENT_COLORS,
  ACCENT_COLOR_SWATCH_CLASS,
  DEFAULT_ACCENT_COLOR,
  isAccentColor,
} from '../lib/accentColor';

describe('accentColor', () => {
  it('has a swatch class for every accent color', () => {
    for (const color of ACCENT_COLORS) {
      expect(ACCENT_COLOR_SWATCH_CLASS[color]).toBeTruthy();
    }
  });

  it('includes the default accent color', () => {
    expect(ACCENT_COLORS).toContain(DEFAULT_ACCENT_COLOR);
  });

  it.each(ACCENT_COLORS)('recognizes %p as a valid accent color', (color) => {
    expect(isAccentColor(color)).toBe(true);
  });

  it('rejects unknown accent colors', () => {
    expect(isAccentColor('not-a-color')).toBe(false);
  });
});
