const TOKEN_KEY = 'token';

// "Remember me" is implemented by WHERE the token is stored, not a
// different session mechanism: checked -> localStorage (persists across
// browser restarts, paired with the backend's normal 30-day token);
// unchecked -> sessionStorage (cleared when the tab closes, paired with a
// short-lived 1-day token). Only one location ever holds a token at a time.
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token, { rememberMe = false } = {}) {
  clearToken();
  (rememberMe ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
