import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

vi.mock('../config/firebase', () => ({
  isFirebaseConfigured: () => true,
}));

const sendPhoneVerificationCodeMock = vi.fn();
const confirmPhoneVerificationCodeMock = vi.fn();
vi.mock('../services/firebaseAuthService', () => ({
  sendPhoneVerificationCode: (...args) => sendPhoneVerificationCodeMock(...args),
  confirmPhoneVerificationCode: (...args) => confirmPhoneVerificationCodeMock(...args),
  resetRecaptcha: vi.fn(),
  isFirebaseConfigured: () => true,
}));

const getSellerApplicationMock = vi.fn();
vi.mock('../services/sellerService', () => ({
  getSellerApplication: (...args) => getSellerApplicationMock(...args),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

const { default: Login } = await import('./Login');

async function verifyPhoneFlow() {
  const nameField = screen.queryByLabelText(/full name/i);
  if (nameField) fireEvent.change(nameField, { target: { value: 'Test User' } });
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await screen.findByText(/enter the code/i);

  fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));
}

describe('Login page', () => {
  beforeEach(() => {
    sendPhoneVerificationCodeMock.mockReset().mockResolvedValue({ confirm: vi.fn() });
    confirmPhoneVerificationCodeMock.mockReset().mockResolvedValue({
      user: { _id: 'u1', name: 'AURA PRO Customer', role: 'customer' },
      token: 'jwt-token',
    });
    getSellerApplicationMock.mockReset().mockResolvedValue(null);
    navigateMock.mockReset();
    localStorage.clear();
  });

  it('shows role selection first, with no phone form yet', () => {
    render(<Login />, { wrapper: AllProviders });

    expect(screen.getByRole('button', { name: /shop on aura pro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sell on aura pro/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/mobile number/i)).not.toBeInTheDocument();
  });

  it('reveals the phone form, defaulted to India, after choosing Buyer', () => {
    render(<Login />, { wrapper: AllProviders });

    fireEvent.click(screen.getByRole('button', { name: /shop on aura pro/i }));

    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country calling code/i)).toHaveValue('IN');
  });

  it('shows the Full name field only in "Create account" mode', () => {
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /shop on aura pro/i }));

    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it('"Change account type" returns to the role picker', () => {
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /shop on aura pro/i }));

    fireEvent.click(screen.getByRole('button', { name: /change account type/i }));

    expect(screen.getByRole('button', { name: /shop on aura pro/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/mobile number/i)).not.toBeInTheDocument();
  });

  it('preselects the role and signup mode from route state (e.g. from "Start selling")', () => {
    render(<Login />, {
      wrapper: (props) => <AllProviders {...props} initialEntries={[{ pathname: '/login', state: { role: 'seller', mode: 'signup' } }]} />,
    });

    expect(screen.queryByRole('button', { name: /shop on aura pro/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it('redirects a buyer to home after a successful login', async () => {
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /shop on aura pro/i }));

    await verifyPhoneFlow();

    await waitFor(() => expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/sell')));
    expect(localStorage.getItem('token')).toBe('jwt-token');
  });

  it('redirects an approved seller straight to the seller dashboard', async () => {
    getSellerApplicationMock.mockResolvedValue({ status: 'approved' });
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /sell on aura pro/i }));

    await verifyPhoneFlow();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/seller', { replace: true }));
  });

  it('redirects a seller with a pending application to the status page', async () => {
    getSellerApplicationMock.mockResolvedValue({ status: 'under_review' });
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /sell on aura pro/i }));

    await verifyPhoneFlow();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sell/status', { replace: true }));
  });

  it('sends a new seller straight into onboarding when they explicitly chose "Create account"', async () => {
    getSellerApplicationMock.mockResolvedValue(null);
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /sell on aura pro/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await verifyPhoneFlow();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sell/onboarding', { replace: true }));
  });

  it('sends a seller with no application to the status page (not silently into onboarding) when they just chose "Sign in"', async () => {
    getSellerApplicationMock.mockResolvedValue(null);
    render(<Login />, { wrapper: AllProviders });
    fireEvent.click(screen.getByRole('button', { name: /sell on aura pro/i }));
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await verifyPhoneFlow();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sell/status', { replace: true }));
  });
});
