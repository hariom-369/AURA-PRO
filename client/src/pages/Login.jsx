import { useLocation, useNavigate } from 'react-router-dom';
import PhoneLoginStep from '../components/PhoneLoginStep';
import { isFirebaseConfigured } from '../config/firebase';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {isFirebaseConfigured() ? (
          <PhoneLoginStep
            onCancel={() => navigate('/')}
            onVerified={() => navigate(location.state?.from?.pathname || '/')}
          />
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Sign-in unavailable</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Phone sign-in isn't configured yet. Please contact the site administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
