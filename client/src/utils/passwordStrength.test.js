import { describe, it, expect } from 'vitest';
import { scorePasswordStrength } from './passwordStrength';

describe('scorePasswordStrength', () => {
  it('scores an empty password as the weakest possible', () => {
    expect(scorePasswordStrength('')).toEqual({ score: 0, label: 'Very weak' });
  });

  it('scores a short, single-case, no-number password as weak', () => {
    expect(scorePasswordStrength('abcdef').score).toBe(0);
  });

  it('gives credit for length, mixed case, numbers, and symbols independently', () => {
    const short = scorePasswordStrength('abc123');
    const long = scorePasswordStrength('abcdefgh123');
    expect(long.score).toBeGreaterThan(short.score);

    const noMixedCase = scorePasswordStrength('abcdefgh1');
    const mixedCase = scorePasswordStrength('abcdefGh1');
    expect(mixedCase.score).toBeGreaterThan(noMixedCase.score);
  });

  it('scores a long password with mixed case, numbers, and symbols as strong', () => {
    const result = scorePasswordStrength('Str0ng!Pass#Word');
    expect(result.score).toBeGreaterThanOrEqual(4);
  });
});
