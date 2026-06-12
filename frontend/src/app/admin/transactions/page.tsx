'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { Receipt, Search, Loader2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTransactions({
        page,
        search: search || undefined,
        payment_status: paymentFilter || undefined,
      });
      setTransactions(data.data ?? []);
      setPagination({
        current_page: data.current_page,
        last_page: data.last_page,
        total: data.total,
      });
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentFilter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTransactions();
  };

  const paymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-100 text-green-700 border-green-600',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-600',
      unpaid: 'bg-gray-100 text-gray-600 border-gray-500',
      expired: 'bg-red-100 text-red-600 border-red-500',
      cancelled: 'bg-red-50 text-red-500 border-red-400',
      failed: 'bg-red-100 text-red-600 border-red-500',
    };
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border-2 ${styles[status] || 'bg-gray-100 text-gray-500 border-gray-400'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-black text-[#1D1D23]">💳 Transactions</h2>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 sm:flex-none">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-2.5 pl-10 pr-4 border-3 border-[#1D1D23] rounded-full bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold text-sm"
                placeholder="Search..."
              />
            </div>
            <button type="submit" className="neobrutal-button px-4 py-2.5 bg-[#1D1D23] text-white text-sm">
              Go
            </button>
          </form>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="py-2.5 px-4 border-3 border-[#1D1D23] rounded-full bg-[#FFFDF7] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="unpaid">Unpaid</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
        </div>
      ) : (
        <>
          <div className="neobrutal-box bg-white shadow-[4px_4px_0px_#1D1D23] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1D1D23] text-white">
                    <th className="text-left py-3 px-4 text-sm font-extrabold">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">User</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Payment</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Reference</th>
                    <th className="text-left py-3 px-4 text-sm font-extrabold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400 font-bold">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn, idx) => (
                      <tr key={txn.id} className={`border-t-2 border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF7]'} hover:bg-purple-50 transition-colors`}>
                        <td className="py-3 px-4 text-sm font-bold text-gray-500">#{txn.id}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-bold text-[#1D1D23]">{txn.user?.name || 'Guest'}</p>
                            <p className="text-xs text-gray-400">{txn.user?.email || '—'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border-2 border-[#1D1D23] ${
                            txn.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {txn.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4">{paymentStatusBadge(txn.payment_status)}</td>
                        <td className="py-3 px-4 text-sm font-bold text-[#1D1D23]">
                          {txn.payment_amount ? `Rp ${Number(txn.payment_amount).toLocaleString('id-ID')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-500 max-w-[140px] truncate">
                          {txn.payment_reference_id || '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 font-medium whitespace-nowrap">
                          {new Date(txn.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} transactions
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
