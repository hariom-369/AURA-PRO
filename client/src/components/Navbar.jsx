import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setCurrentView, cartCount = 0 }) {
  const { user, logout } = useAuth();

  return (
    <header style={styles.header}>
      <div style={styles.logoGroup} onClick={() => setCurrentView('home')}>
        <span style={styles.logoBadge}>PRO</span>
        <h1 style={styles.logoText}>AURA<span style={{ color: '#6366f1' }}>.</span></h1>
      </div>

      <nav style={styles.navLinks}>
        <button
          onClick={() => setCurrentView('home')}
          style={currentView === 'home' ? styles.activeNavLink : styles.navLink}
        >
          Explore Catalog
        </button>

        <button
          onClick={() => setCurrentView('cart')}
          style={currentView === 'cart' ? styles.activeNavLink : styles.navLink}
        >
          Cart
          {cartCount > 0 && <span style={styles.cartBadge}>{cartCount}</span>}
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setCurrentView('admin')}
            style={currentView === 'admin' ? styles.activeNavLink : styles.navLink}
          >
            Admin Studio
          </button>
        )}
      </nav>

      <div style={styles.authGroup}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={styles.userTag}>
              <span style={styles.onlineDot}></span> {user.name}
            </span>
            <button onClick={logout} style={styles.logoutBtn}>Sign Out</button>
          </div>
        ) : (
          <button onClick={() => setCurrentView('login')} style={styles.loginBtn}>
            Account Login
          </button>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 3rem',
    backgroundColor: 'rgba(15, 15, 18, 0.75)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  logoGroup: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  logoBadge: { backgroundColor: '#6366f1', color: '#fff', fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', letterSpacing: '1px' },
  logoText: { fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' },
  navLinks: { display: 'flex', gap: '8px', backgroundColor: '#18181b', padding: '4px', borderRadius: '99px', border: '1px solid #27272a' },
  navLink: { background: 'none', border: 'none', color: '#a1a1aa', padding: '8px 18px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  activeNavLink: { background: '#27272a', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
  cartBadge: { marginLeft: '6px', backgroundColor: '#6366f1', color: '#fff', fontSize: '0.75rem', padding: '2px 7px', borderRadius: '99px', fontWeight: '700' },
  authGroup: { display: 'flex', alignItems: 'center' },
  userTag: { fontSize: '0.85rem', color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '6px' },
  onlineDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' },
  loginBtn: { padding: '8px 18px', backgroundColor: '#fff', color: '#09090b', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' },
  logoutBtn: { padding: '6px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' },
};