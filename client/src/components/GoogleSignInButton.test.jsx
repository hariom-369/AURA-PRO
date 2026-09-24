import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const loadScriptOnceMock = vi.fn();
vi.mock('../utils/loadScript', () => ({
  loadScriptOnce: (...args) => loadScriptOnceMock(...args),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
});

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    loadScriptOnceMock.mockReset();
  });

  it('renders nothing when Google sign-in is not configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.resetModules();
    const { default: GoogleSignInButton } = await import('./GoogleSignInButton');

    const { container } = render(<GoogleSignInButton onCredential={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
    expect(loadScriptOnceMock).not.toHaveBeenCalled();
  });

  it('loads the GIS script, initializes with the client ID, and renders the button', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.resetModules();
    const { default: GoogleSignInButton } = await import('./GoogleSignInButton');

    const initializeMock = vi.fn();
    const renderButtonMock = vi.fn();
    window.google = { accounts: { id: { initialize: initializeMock, renderButton: renderButtonMock } } };
    loadScriptOnceMock.mockResolvedValue(undefined);

    render(<GoogleSignInButton onCredential={vi.fn()} />);

    await waitFor(() => expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' })
    ));
    expect(renderButtonMock).toHaveBeenCalled();
  });

  it('calls onCredential with the ID token when Google reports success', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.resetModules();
    const { default: GoogleSignInButton } = await import('./GoogleSignInButton');

    let capturedCallback;
    window.google = {
      accounts: {
        id: {
          initialize: ({ callback }) => { capturedCallback = callback; },
          renderButton: vi.fn(),
        },
      },
    };
    loadScriptOnceMock.mockResolvedValue(undefined);

    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);
    await waitFor(() => expect(capturedCallback).toBeTruthy());

    capturedCallback({ credential: 'fake-id-token' });
    expect(onCredential).toHaveBeenCalledWith('fake-id-token');
  });

  it('shows a fallback message if the script fails to load (e.g. blocked by an ad blocker)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.resetModules();
    const { default: GoogleSignInButton } = await import('./GoogleSignInButton');

    loadScriptOnceMock.mockRejectedValue(new Error('blocked'));

    render(<GoogleSignInButton onCredential={vi.fn()} />);

    expect(await screen.findByText(/couldn.t load google sign-in/i)).toBeInTheDocument();
  });
});
