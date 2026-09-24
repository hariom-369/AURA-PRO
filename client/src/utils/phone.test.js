import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, isValidNationalNumber, maskPhoneForDisplay } from './phone';

describe('normalizePhoneNumber', () => {
  it('joins the dial code and digits-only national number', () => {
    expect(normalizePhoneNumber('+91', '98765 43210')).toBe('+919876543210');
  });

  it('strips dashes, parens, and other non-digit characters', () => {
    expect(normalizePhoneNumber('+1', '(650) 555-3434')).toBe('+16505553434');
  });
});

describe('isValidNationalNumber', () => {
  it('accepts a typical 10-digit number', () => {
    expect(isValidNationalNumber('9876543210')).toBe(true);
  });

  it('rejects an empty number', () => {
    expect(isValidNationalNumber('')).toBe(false);
  });

  it('rejects a too-short number', () => {
    expect(isValidNationalNumber('12345')).toBe(false);
  });

  it('rejects a too-long number', () => {
    expect(isValidNationalNumber('1'.repeat(15))).toBe(false);
  });
});

describe('maskPhoneForDisplay', () => {
  it('masks all but the last two digits', () => {
    expect(maskPhoneForDisplay('+91', '9876543210')).toBe('+91 ••••••••10');
  });

  it('does not mask when there are two or fewer digits', () => {
    expect(maskPhoneForDisplay('+91', '12')).toBe('+91 12');
  });
});
