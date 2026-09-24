import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

const loginMock = vi.fn();
vi.mock('../services/authService', () => ({
  login: (...args) => loginMock(...args),
  register: vi.fn(),
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

const { default: Login } = await import('./Login');

describe('Login page', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the email/password form, Google divider, and links', () => {
    render(<Login />, { wrapper: AllProviders });

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    render(<Login />, { wrapper: AllProviders });
    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText(/show password/i));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('signs in successfully and redirects to the intended destination', async () => {
    loginMock.mockResolvedValue({ user: { _id: 'u1', name: 'Test', role: 'customer' }, token: 'jwt-token' });
    render(<Login />, {
      wrapper: (props) => <AllProviders {...props} initialEntries={[{ pathname: '/login', state: { from: { pathname: '/checkout' } } }]} />,
    });

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'CorrectHorse1',
      rememberMe: false,
      turnstileToken: '',
    }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/checkout'));
    expect(sessionStorage.getItem('token')).toBe('jwt-token');
  });

  it('stores the token in localStorage when "remember me" is checked', async () => {
    loginMock.mockResolvedValue({ user: { _id: 'u1', name: 'Test', role: 'customer' }, token: 'jwt-token' });
    render(<Login />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.click(screen.getByLabelText(/remember me/i));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-token'));
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('shows a generic error message and preserves the entered email on failure', async () => {
    loginMock.mockRejectedValue({ response: { data: { message: 'Invalid email or password.' } } });
    render(<Login />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'WrongPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(screen.getByLabelText(/email address/i)).toHaveValue('user@example.com');
  });

  it('disables the submit button while a request is in flight, preventing duplicate submissions', async () => {
    let resolveLogin;
    loginMock.mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));
    render(<Login />, { wrapper: AllProviders });

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    resolveLogin({ user: { _id: 'u1', name: 'Test', role: 'customer' }, token: 't' });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
