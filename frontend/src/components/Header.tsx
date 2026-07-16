'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { Camera, LogOut, User as UserIcon, Menu, X, Shield } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await authApi.me();
        setUser(u);
      } catch (err) {
        // User not logged in
      }
    };
    if (localStorage.getItem('fotoseeni_token')) {
      fetchUser();
    }
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    localStorage.removeItem('fotoseeni_token');
    // Hapus cookie agar Next.js Middleware tidak mengizinkan akses ke /dashboard lagi
    document.cookie = 'fotoseeni_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
    setUser(null);
    window.location.href = '/';
  };

  if (
    pathname === '/booth' ||
    pathname === '/select-frame' ||
    pathname === '/edit-photo' ||
    pathname === '/checkout'
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4 bg-[#FFFDF7] border-b-3 border-[#1D1D23]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="p-2 bg-amber-400 border-2 border-[#1D1D23] rounded-xl shadow-[2px_2px_0px_#1D1D23] group-hover:rotate-6 transition-all">
            <Camera className="w-6 h-6 text-[#1D1D23]" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-[#1D1D23]">
            foto<span className="text-[#8A2BE2]">seeni</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">

          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="neobrutal-button px-5 py-2.5 bg-[#1D1D23] text-white hover:bg-[#2d2d35] text-sm flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="neobrutal-button px-5 py-2.5 bg-[#3B82F6] text-white hover:bg-[#4f8ff7] text-sm flex items-center gap-2"
              >
                <UserIcon className="w-4 h-4" /> Gallery
              </Link>
              <button
                onClick={handleLogout}
                className="neobrutal-button px-3 py-2.5 bg-red-100 hover:bg-red-200 border-3 border-[#1D1D23] text-red-600 rounded-full"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="neobrutal-button px-5 py-2.5 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] text-sm"
            >
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile Navigation Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 bg-[#FFFDF7] border-2 border-[#1D1D23] rounded-xl shadow-[2px_2px_0px_#1D1D23] hover:translate-y-[2px] hover:shadow-none transition-all focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-[#1D1D23]" />
          ) : (
            <Menu className="w-6 h-6 text-[#1D1D23]" />
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#FFFDF7] border-b-3 border-[#1D1D23] shadow-lg p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 z-40">

          {user ? (
            <>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="neobrutal-button w-full px-5 py-3 bg-[#1D1D23] text-white hover:bg-[#2d2d35] font-bold flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" /> Admin Panel
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="neobrutal-button w-full px-5 py-3 bg-[#3B82F6] text-white hover:bg-[#4f8ff7] font-bold flex items-center justify-center gap-2"
              >
                <UserIcon className="w-5 h-5" /> Gallery
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="neobrutal-button w-full px-5 py-3 bg-red-100 hover:bg-red-200 border-3 border-[#1D1D23] text-red-600 font-bold flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              onClick={() => setIsMobileMenuOpen(false)}
              className="neobrutal-button w-full px-5 py-3 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] font-bold text-center"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
