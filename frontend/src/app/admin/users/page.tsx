'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { Users, Search, Loader2, Shield, ShieldOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers({ page, search: search || undefined });
      setUsers(data.data ?? []);
      setPagination({
        current_page: data.current_page,
        last_page: data.last_page,
        total: data.total,
      });
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const toggleRole = async (user: any) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${user.name}'s role to ${newRole}?`)) return;
    try {
      await adminApi.updateUserRole(user.id, newRole);
      toast.success(`${user.name} is now ${newRole}!`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-black text-[#1D1D23]">👥 User Management</h2>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2.5 pl-10 pr-4 border-3 border-[#1D1D23] rounded-full bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold text-sm"
              placeholder="Search name or email..."
            />
          </div>
          <button
            type="submit"
            className="neobrutal-button px-4 py-2.5 bg-[#1D1D23] text-white text-sm"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
        </div>
      ) : (
        <>
          {/* Users Table */}
          <div className="neobrutal-box bg-white shadow-[4px_4px_0px_#1D1D23] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1D1D23] text-white">
                    <th className="text-left py-3 px-4 text-sm font-extrabold">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Role</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Sessions</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Joined</th>
                    <th className="text-right py-3 px-4 text-sm font-extrabold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400 font-bold">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user, idx) => (
                      <tr key={user.id} className={`border-t-2 border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF7]'} hover:bg-purple-50 transition-colors`}>
                        <td className="py-3 px-4 text-sm font-bold text-gray-500">#{user.id}</td>
                        <td className="py-3 px-4 text-sm font-bold text-[#1D1D23]">{user.name}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-600">{user.email}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border-2 border-[#1D1D23] ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-[#8A2BE2]'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {user.role === 'admin' ? <Shield className="w-3 h-3" /> : null}
                            {user.role?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-[#1D1D23]">{user.photo_sessions_count ?? 0}</td>
                        <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                          {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => toggleRole(user)}
                            className={`neobrutal-button px-3 py-1.5 text-xs flex items-center gap-1 ml-auto ${
                              user.role === 'admin'
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-purple-100 text-[#8A2BE2] hover:bg-purple-200'
                            }`}
                          >
                            {user.role === 'admin' ? (
                              <><ShieldOff className="w-3 h-3" /> Remove Admin</>
                            ) : (
                              <><Shield className="w-3 h-3" /> Make Admin</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 font-medium">
                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} users total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="neobrutal-button p-2.5 bg-white text-[#1D1D23] disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.last_page, page + 1))}
                  disabled={page >= pagination.last_page}
                  className="neobrutal-button p-2.5 bg-white text-[#1D1D23] disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
