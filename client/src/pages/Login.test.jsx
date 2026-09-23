import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

vi.mock('../config/firebase', () => ({
  isFirebaseConfigured: () => true,
}));

vi.mock('../services/firebaseAuthService', () => ({
  sendPhoneVerificationCode: vi.fn(),
  confirmPhoneVerificationCode: vi.fn(),
  resetRecaptcha: vi.fn(),
  isFirebaseConfigured: () => true,
}));

const { default: Login } = await import('./Login');

describe('Login page', () => {
  it('renders the phone sign-in flow directly, with no email/password form', () => {
    render(<Login />, { wrapper: AllProviders });
    expect(screen.getByPlaceholderText('+1 650 555 3434')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^password$/i)).not.toBeInTheDocument();
  });
});
