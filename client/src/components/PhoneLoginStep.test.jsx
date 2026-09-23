import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import PhoneLoginStep from './PhoneLoginStep';

// Mocked at the service boundary (mirrors how the backend tests mock SDKs
// at their boundary) rather than deep-mocking firebase/auth directly — this
// tests that the component wires phone entry -> send -> confirm -> session
// correctly, without needing to simulate Firebase's own reCAPTCHA/SMS internals.
const sendPhoneVerificationCodeMock = vi.fn();
const confirmPhoneVerificationCodeMock = vi.fn();

vi.mock('../services/firebaseAuthService', () => ({
  sendPhoneVerificationCode: (...args) => sendPhoneVerificationCodeMock(...args),
  confirmPhoneVerificationCode: (...args) => confirmPhoneVerificationCodeMock(...args),
  resetRecaptcha: vi.fn(),
  isFirebaseConfigured: () => true,
}));

describe('PhoneLoginStep', () => {
  beforeEach(() => {
    sendPhoneVerificationCodeMock.mockReset();
    confirmPhoneVerificationCodeMock.mockReset();
    localStorage.clear();
  });

  it('sends a verification code for the entered phone number, then moves to the code-entry step', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText('+1 650 555 3434'), { target: { value: '+16505553434' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(sendPhoneVerificationCodeMock).toHaveBeenCalledWith('+16505553434', expect.any(String)));
    expect(await screen.findByText(/enter the code/i)).toBeInTheDocument();
  });

  it('shows a clear error and stays on the phone-entry step if sending fails', async () => {
    sendPhoneVerificationCodeMock.mockRejectedValue(new Error('Invalid phone number'));
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={vi.fn()} />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText('+1 650 555 3434'), { target: { value: 'not-a-number' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByText(/invalid phone number/i)).toBeInTheDocument();
    expect(screen.queryByText(/enter the code/i)).not.toBeInTheDocument();
  });

  it('confirms the code, completes the session, and calls onVerified', async () => {
    sendPhoneVerificationCodeMock.mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockResolvedValue({
      user: { _id: 'u1', name: 'AURA PRO Customer', role: 'customer' },
      token: 'jwt-token',
    });
    const onVerified = vi.fn();
    render(<PhoneLoginStep onCancel={vi.fn()} onVerified={onVerified} />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText('+1 650 555 3434'), { target: { value: '+16505553434' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByText(/enter the code/i);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(confirmPhoneVerificationCodeMock).toHaveBeenCalledWith(expect.anything(), '123456'));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(localStorage.getItem('token')).toBe('jwt-token');
  });

  it('calls onCancel from the phone-entry step', () => {
    const onCancel = vi.fn();
    render(<PhoneLoginStep onCancel={onCancel} onVerified={vi.fn()} />, { wrapper: AllProviders });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
