import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminListUsers, adminUpdateUserRole, adminUpdateUserStatus } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    adminListUsers({ limit: 50, search: search || undefined })
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
  useEffect(load, [search]);

  const handleRoleToggle = async (targetUser) => {
    const nextRole = targetUser.role === 'admin' ? 'customer' : 'admin';
    setUpdatingId(targetUser._id);
    try {
      const updated = await adminUpdateUserRole(targetUser._id, nextRole);
      setUsers((prev) => prev.map((u) => (u._id === targetUser._id ? updated : u)));
      showToast(`${updated.name} is now ${nextRole}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update role', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (targetUser) => {
    setUpdatingId(targetUser._id);
    try {
      const updated = await adminUpdateUserStatus(targetUser._id, !targetUser.isActive);
      setUsers((prev) => prev.map((u) => (u._id === targetUser._id ? updated : u)));
      showToast(`${updated.name} ${updated.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Users</h3>
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-zinc-400">No users found.</p>
        ) : (
          users.map((u) => {
            const isSelf = u._id === currentUser?._id;
            return (
              <div key={u._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {u.name} {isSelf && <span className="text-xs font-normal text-zinc-400">(you)</span>}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      u.role === 'admin'
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {u.role}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {u.isActive ? 'active' : 'deactivated'}
                  </span>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => handleRoleToggle(u)}
                        disabled={updatingId === u._id}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-zinc-700"
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => handleStatusToggle(u)}
                        disabled={updatingId === u._id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          u.isActive
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
