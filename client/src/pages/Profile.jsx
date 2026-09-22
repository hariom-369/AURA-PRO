import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSeller } from '../context/SellerContext';
import { useToast } from '../context/ToastContext';
import { updateProfile, changePassword, uploadAvatar } from '../services/authService';

const FALLBACK_AVATAR = 'https://api.dicebear.com/9.x/initials/svg?seed=';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { status: sellerStatus } = useSeller();
  const { showToast } = useToast();

  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const avatarUrl = user.avatar || `${FALLBACK_AVATAR}${encodeURIComponent(user.name)}`;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      const updated = await updateProfile(form);
      updateUser(updated);
      showToast('Profile updated', 'success');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await changePassword(pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      setPasswordSuccess('Password changed successfully');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { avatar } = await uploadAvatar(file);
      updateUser({ avatar });
      showToast('Avatar updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Avatar upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const inputClass =
    'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">My Profile</h1>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img src={avatarUrl} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
            <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-xs text-white shadow">
              {uploadingAvatar ? '…' : '✎'}
              <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} className="hidden" />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{user.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  user.role === 'admin'
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {user.role === 'admin' ? 'Administrator' : 'Customer'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
            {user.createdAt && (
              <p className="mt-0.5 text-xs text-zinc-400">
                Member since {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              </p>
            )}
          </div>
        </div>

        {user.role === 'admin' && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 text-sm dark:bg-brand-600/10">
            <span className="text-zinc-700 dark:text-zinc-200">You have administrator access to manage products, orders, coupons, and users.</span>
            <Link to="/admin" className="whitespace-nowrap font-semibold text-brand-600 dark:text-brand-400">
              Open Admin Studio →
            </Link>
          </div>
        )}

        {sellerStatus === 'approved' ? (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/20">
            <span className="text-zinc-700 dark:text-zinc-200">You're an approved seller on AURA PRO.</span>
            <Link to="/seller" className="whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400">
              Open Seller Dashboard →
            </Link>
          </div>
        ) : sellerStatus ? (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
            <span className="text-zinc-700 dark:text-zinc-200">Your seller application status: {sellerStatus}</span>
            <Link to="/sell/status" className="whitespace-nowrap font-semibold text-brand-600 dark:text-brand-400">
              View application →
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
            <span className="text-zinc-700 dark:text-zinc-200">Want to sell your own products on AURA PRO?</span>
            <Link to="/sell" className="whitespace-nowrap font-semibold text-brand-600 dark:text-brand-400">
              Become a Seller →
            </Link>
          </div>
        )}
      </div>

      <form onSubmit={handleProfileSubmit} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Personal Information</h3>
        {profileError && <p className="mt-2 text-sm text-rose-500">{profileError}</p>}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-500">Full name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 w-full ${inputClass}`} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Phone number</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`mt-1 w-full ${inputClass}`} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-500">Email address</label>
            <input value={user.email} disabled className={`mt-1 w-full cursor-not-allowed opacity-60 ${inputClass}`} />
          </div>
        </div>
        <button type="submit" disabled={savingProfile} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {savingProfile ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Change Password</h3>
        {passwordError && <p className="mt-2 text-sm text-rose-500">{passwordError}</p>}
        {passwordSuccess && <p className="mt-2 text-sm text-emerald-500">{passwordSuccess}</p>}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="password"
            placeholder="Current password"
            required
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="New password"
            required
            minLength={8}
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={savingPassword} className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900">
          {savingPassword ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
