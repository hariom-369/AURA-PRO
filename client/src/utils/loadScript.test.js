import { describe, it, expect, beforeEach } from 'vitest';
import { loadScriptOnce } from './loadScript';

describe('loadScriptOnce', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('appends exactly one <script> tag even when called multiple times for the same URL', async () => {
    const src = 'https://example.com/widget.js';
    const p1 = loadScriptOnce(src);
    const p2 = loadScriptOnce(src);

    expect(document.querySelectorAll(`script[src="${src}"]`).length).toBe(1);

    document.querySelector(`script[src="${src}"]`).onload();
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined();
  });

  it('resolves for a second, independent call after the script already finished loading', async () => {
    const src = 'https://example.com/already-loaded.js';
    const p1 = loadScriptOnce(src);
    document.querySelector(`script[src="${src}"]`).onload();
    await p1;

    await expect(loadScriptOnce(src)).resolves.toBeUndefined();
    expect(document.querySelectorAll(`script[src="${src}"]`).length).toBe(1);
  });

  it('rejects if the script fails to load', async () => {
    const src = 'https://example.com/broken.js';
    const promise = loadScriptOnce(src);
    document.querySelector(`script[src="${src}"]`).onerror();

    await expect(promise).rejects.toThrow(/failed to load/i);
  });
});
