import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore user session on app load if token exists
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await API.get('/auth/me');
          setUser(data.data);
        } catch {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const applySession = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  // Firebase Phone Auth's own verification already confirmed the user (see
  // firebaseAuthService.js's confirmPhoneVerificationCode, which returns
  // { user, token }) — this is the single integration point every session,
  // new or returning, goes through.
  const completeFirebasePhoneLogin = (data) => {
    applySession(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Merges fresh fields (e.g. after a profile edit or avatar upload) into the
  // cached user without a full re-fetch.
  const updateUser = (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <AuthContext.Provider value={{ user, loading, logout, updateUser, completeFirebasePhoneLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its Provider by design
export const useAuth = () => useContext(AuthContext);
