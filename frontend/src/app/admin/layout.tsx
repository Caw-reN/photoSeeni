'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api';
import {
  LayoutDashboard, Frame, Key, Users, Receipt, CreditCard,
  Loader2, LogOut, Shield, ChevronLeft, CalendarDays, Menu, X
} from 'lucide-react';
import Link from 'next/link';

interface AdminContextType {
  user: any;
}

const AdminContext = createContext<AdminContextType>({ user: null });
export const useAdmin = () => useContext(AdminContext);

const navGroups = [
  {
    title: 'DASHBOARD',
    items: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    ]
  },
  {
    title: 'APP CONTENT',
    items: [
      { label: 'Frame Templates', href: '/admin/frames', icon: Frame },
      { label: 'Events', href: '/admin/events', icon: CalendarDays },
    ]
  },
  {
    title: 'USERS & FINANCE',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Transactions', href: '/admin/transactions', icon: Receipt },
      { label: 'Payment Settings', href: '/admin/payment', icon: CreditCard },
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'API Keys', href: '/admin/api-keys', icon: Key },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('fotoseeni_token');
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
          localStorage.removeItem('fotoseeni_token');
          router.push('/auth');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    localStorage.removeItem('fotoseeni_token');
    document.cookie = 'fotoseeni_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
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
      <div className="flex min-h-screen bg-[#FFFDF7]">
        
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside 
          className={`
            fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r-4 border-[#1D1D23] 
            flex flex-col transform transition-transform duration-300 ease-in-out overflow-y-auto
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Sidebar Header */}
          <div className="p-6 border-b-4 border-[#1D1D23] bg-[#1D1D23] text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#8A2BE2] rounded-xl border-2 border-white/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">Admin</h1>
                <p className="text-gray-400 font-medium text-xs truncate max-w-[140px]">{user?.email}</p>
              </div>
            </div>
            <button 
              className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Links */}
          <div className="flex-1 p-4 space-y-6">
            {navGroups.map((group, idx) => (
              <div key={idx}>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all
                          ${isActive
                            ? 'bg-[#8A2BE2] text-white border-[#1D1D23] shadow-[3px_3px_0px_#1D1D23]'
                            : 'bg-white text-[#1D1D23] border-transparent hover:border-[#1D1D23] hover:shadow-[3px_3px_0px_#1D1D23]'
                          }
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t-4 border-[#1D1D23] bg-gray-50 shrink-0 space-y-2">
            <Link 
              href="/dashboard" 
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#1D1D23] rounded-xl bg-white text-[#1D1D23] font-bold text-sm hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_#1D1D23]"
            >
              <ChevronLeft className="w-4 h-4" /> User Dashboard
            </Link>
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-500 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors shadow-[2px_2px_0px_rgba(239,68,68,0.3)]"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile Topbar */}
          <div className="lg:hidden sticky top-0 z-30 bg-[#1D1D23] p-4 flex items-center gap-3 shadow-md">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#8A2BE2] rounded-lg border border-white/20">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-white">Admin Panel</h1>
            </div>
          </div>

          {/* Content Wrapper */}
          <div className="flex-1 p-4 md:p-8 lg:px-10 lg:py-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
