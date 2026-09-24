import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

const resetPasswordMock = vi.fn();
vi.mock('../services/authService', () => ({
  resetPassword: (...args) => resetPasswordMock(...args),
  login: vi.fn(),
  register: vi.fn(),
  googleAuth: vi.fn(),
  linkGoogleAccount: vi.fn(),
  forgotPassword: vi.fn(),
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const { default: ResetPassword } = await import('./ResetPassword');

describe('ResetPassword page', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  it('blocks submission on a password mismatch without calling the API', async () => {
    render(<ResetPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'Different1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('submits the new password and shows a success confirmation', async () => {
    resetPasswordMock.mockResolvedValue(null);
    render(<ResetPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'CorrectHorse1', confirmPassword: 'CorrectHorse1' })
    ));
    expect(await screen.findByText(/password has been changed/i)).toBeInTheDocument();
  });

  it('shows an actionable error and an option to request a new link when the token is expired', async () => {
    resetPasswordMock.mockRejectedValue({
      response: { data: { message: 'This password reset link is invalid or has expired. Please request a new one.' } },
    });
    render(<ResetPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });
});
