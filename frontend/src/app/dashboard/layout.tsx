'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Camera, User as UserIcon, Image as ImageIcon, Frame, Loader2, LogOut, PenTool } from 'lucide-react';
import Link from 'next/link';

interface DashboardContextType {
  user: any;
  setUser: (user: any) => void;
  refreshUser: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
});

export const useDashboard = () => useContext(DashboardContext);

const tabs = [
  { label: 'Gallery', href: '/dashboard', icon: ImageIcon },
  { label: 'Profile', href: '/dashboard/profile', icon: UserIcon },
  { label: 'My Frames', href: '/dashboard/frames', icon: Frame },
  { label: 'Frame Builder', href: '/dashboard/builder', icon: PenTool },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData.user ?? userData);
    } catch (err: any) {
      if (err.message?.includes('Session expired')) {
        localStorage.removeItem('fotoseeni_token');
        router.push('/auth');
      }
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('fotoseeni_token');
    if (!token) {
      router.push('/auth');
      return;
    }

    const init = async () => {
      await refreshUser();
      setLoading(false);
    };
    init();
  }, [refreshUser, router]);

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

  return (
    <DashboardContext.Provider value={{ user, setUser, refreshUser }}>
      <div className="flex flex-col flex-1 bg-[#FFFDF7] py-6 px-4 md:py-10 md:px-6">
        <div className="max-w-6xl mx-auto w-full space-y-6">

          {/* Profile Header Card */}
          <div className="neobrutal-box bg-white p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[6px_6px_0px_#1D1D23]">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#1D1D23]">Hey, {user?.name}! 👋</h1>
              <p className="text-gray-500 font-medium text-sm">{user?.email}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/booth" className="neobrutal-button px-5 py-2.5 bg-[#FF7F50] text-[#1D1D23] flex items-center gap-2 text-sm hover:bg-[#ff8e66]">
                <Camera className="w-4 h-4" /> New Session
              </Link>
              <button onClick={handleLogout} className="neobrutal-button px-5 py-2.5 bg-white text-[#1D1D23] flex items-center gap-2 text-sm">
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
                    flex items-center gap-2 px-5 py-3 rounded-full border-3 border-[#1D1D23] font-bold text-sm whitespace-nowrap transition-all
                    ${isActive
                      ? 'bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23]'
                      : 'bg-white text-[#1D1D23] hover:bg-purple-50 shadow-[2px_2px_0px_#1D1D23]'
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
    </DashboardContext.Provider>
  );
}
