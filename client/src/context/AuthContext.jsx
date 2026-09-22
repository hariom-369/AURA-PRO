import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import { verifySignupOtp, verifyLoginOtp, resendOtp as resendOtpRequest } from '../services/authService';

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

  // Both now return { pendingToken, purpose, email, devCode?, emailSent } —
  // no session is created until the OTP step completes via verifyOtp below.
  const login = async (credentials) => {
    const { data } = await API.post('/auth/login', credentials);
    return data.data;
  };

  const register = async (userData) => {
    const { data } = await API.post('/auth/register', userData);
    return { ...data.data, purpose: 'SIGNUP_VERIFICATION' };
  };

  const verifyOtp = async ({ pendingToken, code, purpose }) => {
    const verify = purpose === 'LOGIN' ? verifyLoginOtp : verifySignupOtp;
    const data = await verify({ pendingToken, code });
    applySession(data);
    return data;
  };

  const resendOtp = (pendingToken, purpose) => resendOtpRequest({ pendingToken, purpose });

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Merges fresh fields (e.g. after a profile edit or avatar upload) into the
  // cached user without a full re-fetch.
  const updateUser = (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its Provider by design
export const useAuth = () => useContext(AuthContext);
