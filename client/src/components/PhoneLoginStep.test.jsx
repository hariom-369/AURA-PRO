import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import PhoneLoginStep from './PhoneLoginStep';

// Mocked at the service boundary (mirrors how the backend tests mock SDKs
// at their boundary) rather than deep-mocking firebase/auth directly — this
// tests that the component wires phone entry -> send -> confirm -> session
// correctly, without needing to simulate Firebase's own reCAPTCHA/SMS internals.
const sendPhoneVerificationCodeMock = vi.fn();
const confirmPhoneVerificationCodeMock = vi.fn();
const resetRecaptchaMock = vi.fn();

vi.mock('../services/firebaseAuthService', () => ({
  sendPhoneVerificationCode: (...args) => sendPhoneVerificationCodeMock(...args),
  confirmPhoneVerificationCode: (...args) => confirmPhoneVerificationCodeMock(...args),
  resetRecaptcha: (...args) => resetRecaptchaMock(...args),
  isFirebaseConfigured: () => true,
}));

function enterNumber(value = '9876543210') {
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value } });
}

describe('PhoneLoginStep', () => {
  beforeEach(() => {
    sendPhoneVerificationCodeMock.mockReset();
    confirmPhoneVerificationCodeMock.mockReset();
    resetRecaptchaMock.mockReset();
    localStorage.clear();
  });

  it('sends a verification code for the entered phone number (default India dial code), then moves to the code-entry step', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber('9876543210');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(sendPhoneVerificationCodeMock).toHaveBeenCalledWith('+919876543210', expect.any(String)));
    expect(await screen.findByText(/enter the code/i)).toBeInTheDocument();
  });

  it('does not show "we sent a code" if the send request fails, and shows a friendly message instead of a raw Firebase error', async () => {
    // A number that passes this component's own basic length check, so the
    // request actually reaches (mocked) Firebase, which is what rejects it.
    sendPhoneVerificationCodeMock.mockRejectedValue({ code: 'auth/invalid-phone-number', message: 'Firebase: Error (auth/invalid-phone-number).' });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber('5551234');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/doesn.t look valid/i);
    expect(alert.textContent).not.toMatch(/firebase: error/i);
    expect(screen.queryByText(/enter the code/i)).not.toBeInTheDocument();
  });

  it('rejects an obviously invalid number client-side without ever calling Firebase', async () => {
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber('123');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid phone number/i);
    expect(sendPhoneVerificationCodeMock).not.toHaveBeenCalled();
  });

  it('requires a name in signup mode before sending a code', async () => {
    render(<PhoneLoginStep mode="signup" onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber('9876543210');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/full name/i);
    expect(sendPhoneVerificationCodeMock).not.toHaveBeenCalled();
  });

  it('confirms the code, completes the session, and calls onVerified — passing the name only in signup mode', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockResolvedValue({
      user: { _id: 'u1', name: 'Priya Sharma', role: 'customer' },
      token: 'jwt-token',
    });
    const onVerified = vi.fn();
    render(<PhoneLoginStep mode="signup" onCancel={vi.fn()} onVerified={onVerified} />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Priya Sharma' } });
    enterNumber('9876543210');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(confirmPhoneVerificationCodeMock).toHaveBeenCalledWith(expect.anything(), '123456', 'Priya Sharma'));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(localStorage.getItem('token')).toBe('jwt-token');
  });

  it('shows a friendly message (not a raw error) for an invalid verification code', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockRejectedValue({ code: 'auth/invalid-verification-code', message: 'Firebase: Error (auth/invalid-verification-code).' });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/isn.t correct/i);
  });

  it.each([
    ['auth/too-many-requests', /too many attempts/i],
    ['auth/quota-exceeded', /sms sending limit/i],
    ['auth/captcha-check-failed', /not a robot/i],
  ])('shows the friendly message for %s without ever showing the code screen', async (code, expectedText) => {
    sendPhoneVerificationCodeMock.mockRejectedValue({ code, message: `Firebase: Error (${code}).` });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expectedText);
    expect(screen.queryByText(/enter the code/i)).not.toBeInTheDocument();
  });

  it('shows a network-failure message when the send request cannot reach Firebase, not the raw error', async () => {
    sendPhoneVerificationCodeMock.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error occurred/i);
  });

  it('surfaces the backend\'s own message (e.g. an existing/duplicate account) rather than a generic error on verify', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockRejectedValue({
      response: { data: { message: 'This account has been deactivated. Contact an administrator.' } },
    });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/account has been deactivated/i);
  });

  it('masks the phone number on the code-entry screen', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber('9876543210');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/\+91.*10/)).toBeInTheDocument();
    expect(screen.queryByText(/9876543210/)).not.toBeInTheDocument();
  });

  it('disables "Continue" while a send is in flight, preventing duplicate submissions', async () => {
    let resolveSend;
    sendPhoneVerificationCodeMock.mockReturnValue(new Promise((resolve) => { resolveSend = resolve; }));
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    resolveSend({ confirm: vi.fn() });
    await screen.findByText(/enter the code/i);
  });

  it('starts a 60s resend cooldown after sending, and resend calls Firebase again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);

    expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole('button', { name: /resend code/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /resend code/i }));
    await waitFor(() => expect(sendPhoneVerificationCodeMock).toHaveBeenCalledTimes(2));
    // Resend reuses the existing verifier rather than tearing it down — see
    // firebaseAuthService.js for why recreating it on every send/resend
    // caused "reCAPTCHA has already been rendered in this element".
    expect(resetRecaptchaMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('resets the confirmation state and returns to phone entry on "Use a different number", without tearing down the reCAPTCHA verifier', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);

    fireEvent.click(screen.getByRole('button', { name: /use a different number/i }));

    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    // Deliberately does NOT reset the verifier here — destroying/recreating
    // it on every number change is what previously caused "reCAPTCHA has
    // already been rendered in this element" (see firebaseAuthService.js).
    // The already-solved invisible challenge isn't tied to a phone number.
    expect(resetRecaptchaMock).not.toHaveBeenCalled();
  });

  it('calls onCancel ("Change account type") from the phone-entry step', () => {
    const onCancel = vi.fn();
    render(<PhoneLoginStep onCancel={onCancel} onVerified={vi.fn()} />, { wrapper: AllProviders });

    fireEvent.click(screen.getByRole('button', { name: /change account type/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('resets the reCAPTCHA verifier on unmount, so a stale verifier is never reused after remounting', () => {
    const { unmount } = render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    unmount();

    expect(resetRecaptchaMock).toHaveBeenCalled();
  });

  it('does not warn about updating state on an unmounted component if verification resolves after unmount', async () => {
    let resolveConfirm;
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve; }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });
    enterNumber();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/enter the code/i);
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    cleanup();
    resolveConfirm({ user: { _id: 'u1' }, token: 't' });
    await new Promise((r) => setTimeout(r, 0));

    const reactStateWarning = errorSpy.mock.calls.some((call) => String(call[0]).includes('unmounted component'));
    expect(reactStateWarning).toBe(false);
    errorSpy.mockRestore();
  });
});
