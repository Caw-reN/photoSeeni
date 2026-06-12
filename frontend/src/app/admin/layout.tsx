'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api';
import {
  LayoutDashboard, Frame, Key, Users, Receipt, CreditCard,
  Loader2, LogOut, Shield, ChevronLeft, PenTool
} from 'lucide-react';
import Link from 'next/link';

interface AdminContextType {
  user: any;
}

const AdminContext = createContext<AdminContextType>({ user: null });
export const useAdmin = () => useContext(AdminContext);

const tabs = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Frame Templates', href: '/admin/frames', icon: Frame },
  { label: 'API Keys', href: '/admin/api-keys', icon: Key },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Transactions', href: '/admin/transactions', icon: Receipt },
  { label: 'Payment', href: '/admin/payment', icon: CreditCard },
  { label: 'Frame Builder', href: '/admin/builder', icon: PenTool },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('snapjoy_token');
    if (!token) {
      router.push('/auth');
      return;
    }

    const init = async () => {
      try {
        const userData = await authApi.me();
        const u = userData.user ?? userData;
        if (u.role !== 'admin') {
          // Not admin, redirect to user dashboard
          router.push('/dashboard');
          return;
        }
        setUser(u);
      } catch (err: any) {
        if (err.message?.includes('Session expired')) {
          localStorage.removeItem('snapjoy_token');
          router.push('/auth');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    localStorage.removeItem('snapjoy_token');
    document.cookie = 'snapjoy_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AdminContext.Provider value={{ user }}>
      <div className="flex flex-col flex-1 bg-[#FFFDF7] py-6 px-4 md:py-10 md:px-6">
        <div className="max-w-7xl mx-auto w-full space-y-6">

          {/* Admin Header */}
          <div className="neobrutal-box bg-gradient-to-r from-[#1D1D23] to-[#2d2d35] p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[6px_6px_0px_#8A2BE2]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#8A2BE2] rounded-xl border-2 border-white/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">Admin Panel</h1>
                <p className="text-gray-400 font-medium text-sm">{user?.name} — {user?.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="neobrutal-button px-4 py-2 bg-white/10 text-white border-white/30 flex items-center gap-2 text-sm hover:bg-white/20">
                <ChevronLeft className="w-4 h-4" /> User Dashboard
              </Link>
              <button onClick={handleLogout} className="neobrutal-button px-4 py-2 bg-red-500/20 text-red-300 border-red-500/40 flex items-center gap-2 text-sm hover:bg-red-500/30">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-full border-3 border-[#1D1D23] font-bold text-sm whitespace-nowrap transition-all
                    ${isActive
                      ? 'bg-[#1D1D23] text-white shadow-[3px_3px_0px_#8A2BE2]'
                      : 'bg-white text-[#1D1D23] hover:bg-gray-50 shadow-[2px_2px_0px_#1D1D23]'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Tab Content */}
          <div>
            {children}
          </div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
