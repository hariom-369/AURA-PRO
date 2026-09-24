import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import * as authService from '../services/authService';
import { getToken, setToken as persistToken, clearToken } from '../utils/tokenStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore user session on app load if a token exists (either storage).
  useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      if (token) {
        try {
          const { data } = await API.get('/auth/me');
          setUser(data.data);
        } catch {
          clearToken();
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const applySession = (data, { rememberMe = false } = {}) => {
    persistToken(data.token, { rememberMe });
    setUser(data.user);
  };

  const login = async (payload) => {
    const data = await authService.login(payload);
    applySession(data, { rememberMe: payload.rememberMe });
    return data;
  };

  // A fresh signup implies "keep me signed in" — no remember-me checkbox on
  // that form, matching how most consumer signup flows behave.
  const register = async (payload) => {
    const data = await authService.register(payload);
    applySession(data, { rememberMe: true });
    return data;
  };

  const loginWithGoogle = async (idToken) => {
    const data = await authService.googleAuth(idToken);
    applySession(data, { rememberMe: true });
    return data;
  };

  // Links Google to the ALREADY-authenticated account — the user proved who
  // they are via their existing session first; this never creates or
  // switches a session, only updates the current one's linked-provider info.
  const linkGoogleAccount = async (idToken) => {
    const updated = await authService.linkGoogleAccount(idToken);
    setUser((prev) => (prev ? { ...prev, ...updated } : updated));
    return updated;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  // Merges fresh fields (e.g. after a profile edit or avatar upload) into the
  // cached user without a full re-fetch.
  const updateUser = (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, linkGoogleAccount, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its Provider by design
export const useAuth = () => useContext(AuthContext);
