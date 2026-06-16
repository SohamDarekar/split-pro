export const CURRENCIES = {
  AUD: {
    symbol: 'AU$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    code: 'AUD',
  },
  INR: {
    symbol: '₹',
    symbolNative: '₹',
    decimalDigits: 2,
    rounding: 0,
    code: 'INR',
  },
};

export type CurrencyCode = keyof typeof CURRENCIES;

export const isCurrencyCode = (value?: string | null): value is CurrencyCode =>
  !!value && value in CURRENCIES;

export const parseCurrencyCode = (code: string): CurrencyCode =>
  isCurrencyCode(code) ? code : 'AUD';
