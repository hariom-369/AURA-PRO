import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

const registerMock = vi.fn();
vi.mock('../services/authService', () => ({
  register: (...args) => registerMock(...args),
  login: vi.fn(),
  googleAuth: vi.fn(),
  linkGoogleAccount: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

const { default: Register } = await import('./Register');

function fillCommonFields({ name = 'New User', email = 'new@example.com', password = 'CorrectHorse1', confirm = 'CorrectHorse1' } = {}) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('Register page', () => {
  beforeEach(() => {
    registerMock.mockReset();
    navigateMock.mockReset();
  });

  it('defaults to Buyer and shows both account type options', () => {
    render(<Register />, { wrapper: AllProviders });
    expect(screen.getByRole('button', { name: 'Buyer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Seller' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a live password strength indicator', () => {
    render(<Register />, { wrapper: AllProviders });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Str0ng!Pass#Word' } });
    expect(screen.getByText(/password strength/i)).toBeInTheDocument();
  });

  it('blocks submission on a password mismatch, without calling the API', async () => {
    render(<Register />, { wrapper: AllProviders });
    fillCommonFields({ confirm: 'SomethingDifferent1' });
    fireEvent.click(screen.getByRole('button', { name: /create.*account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('requires accepting the terms before the submit button is enabled', () => {
    render(<Register />, { wrapper: AllProviders });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'CorrectHorse1' } });

    expect(screen.getByRole('button', { name: /create.*account/i })).toBeDisabled();
  });

  it('creates a buyer account and redirects home', async () => {
    registerMock.mockResolvedValue({ user: { _id: 'u1', name: 'New User', role: 'customer' }, token: 'jwt-token' });
    render(<Register />, { wrapper: AllProviders });
    fillCommonFields();
    fireEvent.click(screen.getByRole('button', { name: /create.*account/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('creates a seller-intent account and redirects into seller onboarding', async () => {
    registerMock.mockResolvedValue({ user: { _id: 'u1', name: 'New User', role: 'customer' }, token: 'jwt-token' });
    render(<Register />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: 'Seller' }));
    fillCommonFields();
    fireEvent.click(screen.getByRole('button', { name: /create seller account/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sell/onboarding'));
  });

  it('never sends a role/accountType field to the backend — only name/email/password/confirmPassword/acceptedTerms', async () => {
    registerMock.mockResolvedValue({ user: { _id: 'u1', name: 'New User', role: 'customer' }, token: 't' });
    render(<Register />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: 'Seller' }));
    fillCommonFields();
    fireEvent.click(screen.getByRole('button', { name: /create seller account/i }));

    await waitFor(() => expect(registerMock).toHaveBeenCalled());
    const payload = registerMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('accountType');
  });

  it('shows the backend error message and does not navigate away on failure', async () => {
    registerMock.mockRejectedValue({ response: { data: { message: 'An account with this email already exists. Please sign in instead.' } } });
    render(<Register />, { wrapper: AllProviders });
    fillCommonFields();
    fireEvent.click(screen.getByRole('button', { name: /create.*account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
