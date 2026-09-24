import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const loadScriptOnceMock = vi.fn();
vi.mock('../utils/loadScript', () => ({
  loadScriptOnce: (...args) => loadScriptOnceMock(...args),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.turnstile;
});

describe('TurnstileWidget', () => {
  beforeEach(() => {
    loadScriptOnceMock.mockReset();
  });

  it('renders nothing when Turnstile is not configured', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    vi.resetModules();
    const { default: TurnstileWidget } = await import('./TurnstileWidget');

    const { container } = render(<TurnstileWidget onVerify={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
    expect(loadScriptOnceMock).not.toHaveBeenCalled();
  });

  it('renders the widget and calls onVerify with the token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    vi.resetModules();
    const { default: TurnstileWidget } = await import('./TurnstileWidget');

    let capturedCallback;
    window.turnstile = {
      render: (el, opts) => {
        capturedCallback = opts.callback;
        return 'widget-1';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    loadScriptOnceMock.mockResolvedValue(undefined);

    const onVerify = vi.fn();
    render(<TurnstileWidget onVerify={onVerify} />);
    await waitFor(() => expect(capturedCallback).toBeTruthy());

    capturedCallback('turnstile-token-abc');
    expect(onVerify).toHaveBeenCalledWith('turnstile-token-abc');
  });

  it('clears the token via onVerify("") when the challenge expires', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    vi.resetModules();
    const { default: TurnstileWidget } = await import('./TurnstileWidget');

    let capturedExpiredCallback;
    window.turnstile = {
      render: (el, opts) => {
        capturedExpiredCallback = opts['expired-callback'];
        return 'widget-1';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    loadScriptOnceMock.mockResolvedValue(undefined);

    const onVerify = vi.fn();
    render(<TurnstileWidget onVerify={onVerify} />);
    await waitFor(() => expect(capturedExpiredCallback).toBeTruthy());

    capturedExpiredCallback();
    expect(onVerify).toHaveBeenCalledWith('');
  });

  it('exposes reset() via ref, which forces a fresh (single-use) token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    vi.resetModules();
    const { default: TurnstileWidget } = await import('./TurnstileWidget');

    const resetMock = vi.fn();
    window.turnstile = { render: () => 'widget-1', reset: resetMock, remove: vi.fn() };
    loadScriptOnceMock.mockResolvedValue(undefined);

    const ref = createRef();
    render(<TurnstileWidget ref={ref} onVerify={vi.fn()} />);
    await waitFor(() => expect(ref.current).toBeTruthy());

    ref.current.reset();
    expect(resetMock).toHaveBeenCalledWith('widget-1');
  });

  it('shows a fallback message if the script fails to load', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    vi.resetModules();
    const { default: TurnstileWidget } = await import('./TurnstileWidget');

    loadScriptOnceMock.mockRejectedValue(new Error('blocked'));

    render(<TurnstileWidget onVerify={vi.fn()} />);

    expect(await screen.findByText(/couldn.t load the verification widget/i)).toBeInTheDocument();
  });
});
