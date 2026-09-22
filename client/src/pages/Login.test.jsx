import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import Login from './Login';

describe('Login page', () => {
  it('renders identifier/password fields and links to register and password reset', () => {
    render(<Login />, { wrapper: AllProviders });
    expect(screen.getByPlaceholderText(/email or mobile number/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot your password/i })).toBeInTheDocument();
  });
});
