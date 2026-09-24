import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

const forgotPasswordMock = vi.fn();
vi.mock('../services/authService', () => ({
  forgotPassword: (...args) => forgotPasswordMock(...args),
  login: vi.fn(),
  register: vi.fn(),
  googleAuth: vi.fn(),
  linkGoogleAccount: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const { default: ForgotPassword } = await import('./ForgotPassword');

describe('ForgotPassword page', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it('shows the same generic confirmation regardless of whether the email exists', async () => {
    forgotPasswordMock.mockResolvedValue(null);
    render(<ForgotPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'anyone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/anyone@example.com/)).toBeInTheDocument();
  });

  it('disables submission while sending, preventing duplicate requests', async () => {
    let resolveIt;
    forgotPasswordMock.mockReturnValue(new Promise((resolve) => { resolveIt = resolve; }));
    render(<ForgotPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'anyone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    resolveIt(null);
    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
  });

  it('shows an error message if the request itself fails (not the enumeration-safe generic path)', async () => {
    forgotPasswordMock.mockRejectedValue({ response: { data: { message: 'Something went wrong. Please try again.' } } });
    render(<ForgotPassword />, { wrapper: AllProviders });

    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'anyone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
