import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';

// A separate file (not a branch inside Login.test.jsx) because vi.mock's
// factory is fixed per module for the whole file — this is the missing-env-
// var case that produced "Sign-in unavailable" in production when the four
// VITE_FIREBASE_* build args weren't reaching the deployed build.
vi.mock('../config/firebase', () => ({
  isFirebaseConfigured: () => false,
}));

const { default: Login } = await import('./Login');

describe('Login page — Firebase not configured', () => {
  it('shows the "Sign-in unavailable" fallback instead of the phone form, with no way to reach it', () => {
    render(<Login />, { wrapper: AllProviders });

    expect(screen.getByText(/sign-in unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/phone sign-in isn't configured yet/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('+1 650 555 3434')).not.toBeInTheDocument();
  });
});
