import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, clearToken } from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores in localStorage when rememberMe is true', () => {
    setToken('abc', { rememberMe: true });
    expect(localStorage.getItem('token')).toBe('abc');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('stores in sessionStorage when rememberMe is false', () => {
    setToken('abc', { rememberMe: false });
    expect(sessionStorage.getItem('token')).toBe('abc');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('getToken reads from either storage', () => {
    setToken('from-local', { rememberMe: true });
    expect(getToken()).toBe('from-local');

    clearToken();
    setToken('from-session', { rememberMe: false });
    expect(getToken()).toBe('from-session');
  });

  it('setToken clears the other storage so only one location ever holds a token', () => {
    setToken('first', { rememberMe: true });
    setToken('second', { rememberMe: false });

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBe('second');
  });

  it('clearToken removes the token from both storages', () => {
    localStorage.setItem('token', 'x');
    sessionStorage.setItem('token', 'y');

    clearToken();

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });
});
