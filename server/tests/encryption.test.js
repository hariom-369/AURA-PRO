import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, last4 } from '../utils/encryption.js';

describe('encryption util (seller payout fields)', () => {
  it('round-trips a plaintext value through encrypt/decrypt', () => {
    const encrypted = encryptSecret('1234567890123456');
    expect(encrypted).not.toContain('1234567890123456');
    expect(decryptSecret(encrypted)).toBe('1234567890123456');
  });

  it('produces a different ciphertext each time (random IV) even for the same input', () => {
    const a = encryptSecret('SAME-VALUE');
    const b = encryptSecret('SAME-VALUE');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('SAME-VALUE');
    expect(decryptSecret(b)).toBe('SAME-VALUE');
  });

  it('returns null for empty/nullish input instead of encrypting nothing', () => {
    expect(encryptSecret('')).toBeNull();
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it('rejects a tampered ciphertext rather than silently returning wrong data', () => {
    const encrypted = encryptSecret('secret-account-number');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('last4 extracts only the last 4 digits, ignoring spaces', () => {
    expect(last4('1234 5678 9012 3456')).toBe('3456');
    expect(last4('9876543210')).toBe('3210');
    expect(last4('')).toBe('');
  });
});
