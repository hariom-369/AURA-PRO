import { createContext, useContext, useEffect, useState } from 'react';

const CompareContext = createContext();
const KEY = 'aura_compare_ids';
const MAX = 4;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export const CompareProvider = ({ children }) => {
  const [ids, setIds] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // Non-fatal
    }
  }, [ids]);

  const toggleCompare = (productId) => {
    setIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= MAX) return prev;
      return [...prev, productId];
    });
  };

  const clearCompare = () => setIds([]);

  return <CompareContext.Provider value={{ ids, toggleCompare, clearCompare, max: MAX }}>{children}</CompareContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its Provider by design
export const useCompare = () => useContext(CompareContext);
