import { describe, it, expect } from 'vitest';
import { friendlyFirebaseAuthError } from './firebaseAuthErrors';

describe('friendlyFirebaseAuthError', () => {
  it('maps a known Firebase error code to friendly copy', () => {
    expect(friendlyFirebaseAuthError({ code: 'auth/invalid-phone-number' })).toMatch(/doesn.t look valid/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/too-many-requests' })).toMatch(/too many attempts/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/invalid-verification-code' })).toMatch(/isn.t correct/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/quota-exceeded' })).toMatch(/sms sending limit/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/operation-not-allowed' })).toMatch(/isn.t enabled/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/code-expired' })).toMatch(/expired/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/session-expired' })).toMatch(/session expired/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/captcha-check-failed' })).toMatch(/not a robot/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/network-request-failed' })).toMatch(/network error/i);
  });

  it('maps configuration-class errors distinctly, framed as a site problem rather than a retry-and-it-might-work message', () => {
    expect(friendlyFirebaseAuthError({ code: 'auth/invalid-app-credential' })).toMatch(/configured correctly/i);
    expect(friendlyFirebaseAuthError({ code: 'auth/app-not-authorized' })).toMatch(/isn.t authorized/i);
  });

  it('never leaks a raw "Firebase: Error (auth/xxx)" string for an unrecognized auth code', () => {
    const message = friendlyFirebaseAuthError({ code: 'auth/some-new-code', message: 'Firebase: Error (auth/some-new-code).' });
    expect(message).not.toMatch(/firebase: error/i);
  });

  it('uses the backend\'s own response message when present', () => {
    const message = friendlyFirebaseAuthError({ response: { data: { message: 'An account already exists with this phone number.' } } });
    expect(message).toBe('An account already exists with this phone number.');
  });

  it('falls back to a generic message with no code, no backend message, and no message', () => {
    expect(friendlyFirebaseAuthError({})).toBe('Something went wrong. Please try again.');
  });

  it('uses a plain error message from our own code (not a raw Firebase string)', () => {
    expect(friendlyFirebaseAuthError(new Error('Phone sign-in is not configured.'))).toBe('Phone sign-in is not configured.');
  });
});
