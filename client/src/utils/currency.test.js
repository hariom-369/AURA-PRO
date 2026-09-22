import { describe, it, expect } from 'vitest';
import { formatINR } from './currency';

describe('formatINR', () => {
  it('formats a positive number with the rupee symbol and Indian grouping', () => {
    expect(formatINR(1999)).toBe('₹1,999');
    expect(formatINR(100000)).toBe('₹1,00,000');
  });

  it('treats missing/undefined/null as zero', () => {
    expect(formatINR(undefined)).toBe('₹0');
    expect(formatINR(null)).toBe('₹0');
  });
});
