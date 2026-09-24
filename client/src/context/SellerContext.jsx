import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSellerApplication } from '../services/sellerService';

const SellerContext = createContext();

// Tracks the logged-in user's seller application/status (if any) in one
// place, so Navbar/Profile/SellerRoute/the onboarding pages all share a
// single fetch instead of each querying it independently. `application` is
// null both while loading and when the user has never started one — check
// `loading` to tell those apart.
export const SellerProvider = ({ children }) => {
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) {
      setApplication(null);
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    return getSellerApplication()
      .then((app) => {
        setApplication(app);
        return app;
      })
      .catch(() => {
        setApplication(null);
        return null;
      })
      .finally(() => setLoading(false));
  }, [user]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/user-change pattern
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SellerContext.Provider value={{ application, status: application?.status || null, loading, refresh }}>
      {children}
    </SellerContext.Provider>
  );
};

export const useSeller = () => useContext(SellerContext);
