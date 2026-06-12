'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Users, Camera, DollarSign, TrendingUp, Clock, CreditCard, Loader2 } from 'lucide-react';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.getStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-gray-500 font-bold py-12">Failed to load statistics.</p>;
  }

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'bg-purple-100', iconColor: 'text-[#8A2BE2]', border: 'shadow-[4px_4px_0px_#8A2BE2]' },
    { label: 'Total Sessions', value: stats.total_sessions, icon: Camera, color: 'bg-orange-100', iconColor: 'text-[#FF7F50]', border: 'shadow-[4px_4px_0px_#FF7F50]' },
    { label: 'Completed', value: stats.completed_sessions, icon: TrendingUp, color: 'bg-green-100', iconColor: 'text-green-600', border: 'shadow-[4px_4px_0px_#16a34a]' },
    { label: 'Today Sessions', value: stats.today_sessions, icon: Clock, color: 'bg-blue-100', iconColor: 'text-[#3B82F6]', border: 'shadow-[4px_4px_0px_#3B82F6]' },
    { label: 'Total Revenue', value: `Rp ${Number(stats.total_revenue).toLocaleString('id-ID')}`, icon: DollarSign, color: 'bg-yellow-100', iconColor: 'text-yellow-600', border: 'shadow-[4px_4px_0px_#ca8a04]' },
    { label: 'Paid Payments', value: stats.paid_payments, icon: CreditCard, color: 'bg-emerald-100', iconColor: 'text-emerald-600', border: 'shadow-[4px_4px_0px_#059669]' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-black text-[#1D1D23]">📊 Dashboard Overview</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`neobrutal-box bg-white p-5 ${card.border} flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl border-2 border-[#1D1D23] ${card.color}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-black text-[#1D1D23]">{card.value}</p>
                <p className="text-sm font-bold text-gray-500 mt-0.5">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-Day Chart */}
      <div className="neobrutal-box bg-white p-6 shadow-[4px_4px_0px_#1D1D23]">
        <h3 className="text-lg font-extrabold text-[#1D1D23] mb-6">📈 Last 7 Days Activity</h3>
        <div className="space-y-3">
          {stats.daily_sessions?.map((day: any) => {
            const maxCount = Math.max(...stats.daily_sessions.map((d: any) => d.count), 1);
            const percentage = (day.count / maxCount) * 100;
            const dateLabel = new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-500 w-28 text-right flex-shrink-0">{dateLabel}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-full border-2 border-[#1D1D23] overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#FF7F50] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(percentage, 3)}%` }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#1D1D23]">
                    {day.count} session{day.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-400 w-24 flex-shrink-0">
                  Rp {Number(day.revenue).toLocaleString('id-ID')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="neobrutal-box bg-white p-5 shadow-[4px_4px_0px_#1D1D23]">
          <h4 className="text-sm font-extrabold text-gray-500 mb-2 uppercase tracking-wide">Pending Payments</h4>
          <p className="text-3xl font-black text-[#FF7F50]">{stats.pending_payments}</p>
          <p className="text-sm text-gray-400 font-medium mt-1">Awaiting payment confirmation</p>
        </div>
        <div className="neobrutal-box bg-white p-5 shadow-[4px_4px_0px_#1D1D23]">
          <h4 className="text-sm font-extrabold text-gray-500 mb-2 uppercase tracking-wide">Conversion Rate</h4>
          <p className="text-3xl font-black text-[#8A2BE2]">
            {stats.total_sessions > 0 ? ((stats.paid_payments / stats.total_sessions) * 100).toFixed(1) : 0}%
          </p>
          <p className="text-sm text-gray-400 font-medium mt-1">Paid / Total sessions</p>
        </div>
      </div>
    </div>
  );
}
