'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Loader2, Lock, Mail, User } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let token = '';
      if (isLogin) {
        const response = await authApi.login({ email, password });
        token = response.access_token;
      } else {
        const response = await authApi.register({ name, email, password, password_confirmation: passwordConfirmation });
        token = response.access_token;
      }
      
      // Simpan di LocalStorage untuk client-side fetching
      localStorage.setItem('snapjoy_token', token);
      
      // Simpan juga di Cookies agar Middleware (server-side) bisa membacanya
      // Expire dalam 7 hari (604800 detik)
      document.cookie = `snapjoy_token=${token}; path=/; max-age=604800; SameSite=Lax; Secure`;

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center py-12 px-6 bg-[#FFFDF7]">
      <div className="neobrutal-box bg-white p-8 max-w-md w-full shadow-[8px_8px_0px_#1D1D23]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#1D1D23]">
            {isLogin ? 'Welcome Back!' : 'Join the Joy!'}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isLogin ? 'Sign in to access your saved photobooths' : 'Create an account to save and share your photos'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 border-2 border-red-200 p-3 rounded-lg text-sm font-bold mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1">Your Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#FFFDF7] border-2 border-[#1D1D23] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-extrabold text-[#1D1D23] mb-1">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#FFFDF7] border-2 border-[#1D1D23] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-[#1D1D23] mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#FFFDF7] border-2 border-[#1D1D23] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold"
                placeholder="••••••••"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#FFFDF7] border-2 border-[#1D1D23] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="neobrutal-button w-full py-4 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 text-lg"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-[#8A2BE2] hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
