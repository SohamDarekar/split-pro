// Filepath: /home/wiktor/kod/split-pro/src/utils/number.test.ts
import { currencyConversion, getCurrencyHelpers } from '../utils/numbers';

describe('getCurrencyHelpers', () => {
  describe('toUIString', () => {
    describe('en-US locale', () => {
      const locale = 'en-US';

      describe('AUD', () => {
        const currency = 'AUD';
        const { toUIString } = getCurrencyHelpers({ locale, currency });

        it.each([
          [12345n, 'A$123.45'],
          [-12345n, 'A$123.45'],
          [-50n, 'A$0.5'],
          [-0n, 'A$0'],
          [99999999999999999999999999999n, 'A$999,999,999,999,999,999,999,999,999.99'],
          [-99999999999999999999999999999n, 'A$999,999,999,999,999,999,999,999,999.99'],
        ])('should format %p as %p ', (value, expected) => {
          expect(toUIString(value)).toBe(expected);
        });

        it('should format with thousands separators for large numbers', () => {
          const value = 12345678900n;
          expect(toUIString(value)).toBe('A$123,456,789');
        });

        it('should insert thousands separators for single ~1k values', () => {
          const value = 123400n;
          expect(toUIString(value)).toBe('A$1,234');
        });

        it('Should correctly format single digit cent amounts', () => {
          const value = 7n;
          expect(toUIString(value)).toBe('A$0.07');
        });

        it.each([
          [12345n, 'A$123.45'],
          [-12345n, '-A$123.45'],
          [-50n, '-A$0.5'],
          [-0n, 'A$0'],
          [99999999999999999999999999999n, 'A$999,999,999,999,999,999,999,999,999.99'],
          [-99999999999999999999999999999n, '-A$999,999,999,999,999,999,999,999,999.99'],
        ])('should format %p as %p with signed flag', (value, expected) => {
          expect(toUIString(value, true)).toBe(expected);
        });
      });
    });

    describe('bg-BG locale', () => {
      const locale = 'bg-BG';

      describe('INR', () => {
        const currency = 'INR';

        const { toUIString } = getCurrencyHelpers({ locale, currency });

        it.each([
          [12345n, '123,45 INR'],
          [-12345n, '123,45 INR'],
          [-50n, '0,5 INR'],
          [-0n, '0 INR'],
        ])('should format %p as %p ', (value, expected) => {
          expect(toUIString(value)).toBe(expected);
        });

        it('should format with thousands separators for large numbers', () => {
          expect(toUIString(12345678900n)).toBe('123 456 789 INR');
          expect(toUIString(5678900n)).toBe('56 789 INR');
        });

        it('should not insert thousands separators for single ~1k values', () => {
          const value = 123400n;
          expect(toUIString(value)).toBe('1234 INR');
        });
      });
    });
  });

  describe('toSafeBigInt', () => {
    const { toSafeBigInt } = getCurrencyHelpers({
      locale: 'en-US',
      currency: 'AUD',
    });

    it.each([
      ['123.45', 12345n],
      ['0.99', 99n],
      ['1000', 100000n],
      ['1000.5', 100050n],
      ['0', 0n],
      ['', 0n],
      ['invalid', 0n],
      [123.45, 12345n],
      [0.99, 99n],
      [1000, 100000n],
      [1000.5, 100050n],
      [NaN, 0n],
      [0, 0n],
      [12345n, 12345n],
      [0n, 0n],
    ])('should parse %p to %p ', (input, expected) => {
      expect(toSafeBigInt(input)).toBe(expected);
    });

    it.each([
      ['-123.45', -12345n],
      ['-0.99', -99n],
      ['-100.01', -10001n],
      ['-1000', -100000n],
      ['-1000.5', -100050n],

      [-123.45, -12345n],
      [-0.99, -99n],
      [-1000, -100000n],
      [-1000.5, -100050n],
    ])('should parse %p to %p with signed flag', (input, expected) => {
      expect(toSafeBigInt(input, true)).toBe(expected);
    });

    it.each([
      ['123456789012345678901234567890.12', 12345678901234567890123456789012n],
      ['0.000000000000000000000000000001', 0n],
      ['-123456789012345678901234567890.12', -12345678901234567890123456789012n],
    ])('should parse big numbers %p to %p ', (input, expected) => {
      expect(toSafeBigInt(input, true)).toBe(expected);
    });
  });

  describe('sanitizeInput', () => {
    const { sanitizeInput } = getCurrencyHelpers({
      locale: 'en-US',
      currency: 'AUD',
    });

    it.each([
      ['123.45', '123.45'],
      ['1,234.56', '1234.56'],
      ['1,234.56789', '1234.56'],
      ['$1,234.56', '1234.56'],
      ['$1,234.56789', '1234.56'],
      ['-123.45', '123.45'],
      ['abc123.45xyz', '123.45'],
      ['..123..45..', '.12'],
      ['', ''],
    ])('should sanitize %p to %p', (input, expected) => {
      expect(sanitizeInput(input, false)).toBe(expected);
    });

    it.each([
      ['-123.45', '-123.45'],
      ['(-123.45)', '-123.45'],
      ['-$1,234.56', '-1234.56'],
      ['abc-123.45xyz', '-123.45'],
      ['--123.45', '-123.45'],
    ])('should sanitize %p to %p with signed flag', (input, expected) => {
      expect(sanitizeInput(input, true)).toBe(expected);
    });
  });
});

describe('currencyConversion', () => {
  it('handles same decimal digit conversions', () => {
    const from = 'AUD'; // 2 decimal digits
    const to = 'INR'; // 2 decimal digits
    const amount = 12345n; // 123.45 AUD
    const rate = 56.6; // 1 AUD = 56.6 INR

    const res = currencyConversion({ from, to, amount, rate });

    // 123.45 AUD * 56.6 = 6987.27 INR -> 698727 in bigint
    expect(res).toBe(698727n);
  });

  it('handles the inverse conversion', () => {
    const from = 'INR';
    const to = 'AUD';
    const amount = 698727n;
    const rate = 1 / 56.6;

    const res = currencyConversion({ from, to, amount, rate });

    expect(res).toBe(12345n);
  });
});
