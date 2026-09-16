import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Cart from './pages/Cart';
import AdminDashboard from './pages/admin/AdminDashboard';
import API from './api/axios';
import { useAuth } from './context/AuthContext';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [cartCount, setCartCount] = useState(0);
  const { user } = useAuth();

  const fetchCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    try {
      const { data } = await API.get('/cart');
      const count = data.data?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    fetchCartCount();
  }, [user]);

  return (
    <div>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} cartCount={cartCount} />

      {currentView === 'home' && <Home onCartUpdated={fetchCartCount} />}
      {currentView === 'cart' && <Cart onCartUpdated={fetchCartCount} />}
      {currentView === 'login' && <Login onSuccess={() => setCurrentView('home')} />}
      {currentView === 'admin' && <AdminDashboard onProductAdded={() => setCurrentView('home')} />}
    </div>
  );
}

export default App;