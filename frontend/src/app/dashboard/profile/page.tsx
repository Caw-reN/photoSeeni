'use client';

import { useState } from 'react';
import { useDashboard } from '../layout';
import { authApi } from '@/lib/api';
import { Save, Loader2, Eye, EyeOff, User as UserIcon, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, refreshUser } = useDashboard();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: any = {};

      if (name !== user?.name) payload.name = name;
      if (email !== user?.email) payload.email = email;

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('New password and confirmation do not match!');
          setSaving(false);
          return;
        }
        if (!currentPassword) {
          toast.error('Please enter your current password to change it.');
          setSaving(false);
          return;
        }
        payload.current_password = currentPassword;
        payload.password = newPassword;
        payload.password_confirmation = confirmPassword;
      }

      if (Object.keys(payload).length === 0) {
        toast.info('No changes to save.');
        setSaving(false);
        return;
      }

      await authApi.updateProfile(payload);
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Profile updated successfully! 🎉');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-[#1D1D23]">👤 Edit Profile</h2>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Basic Info */}
        <div className="neobrutal-box bg-white p-6 shadow-[4px_4px_0px_#1D1D23]">
          <h3 className="text-lg font-extrabold text-[#1D1D23] mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#8A2BE2]" /> Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full py-3 px-4 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold transition-all"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-3 px-4 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* Account Info (read-only) */}
          <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500 font-medium">
            <span>Role: <strong className="text-[#8A2BE2] uppercase">{user?.role || 'user'}</strong></span>
            <span>Joined: <strong>{user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</strong></span>
          </div>
        </div>

        {/* Change Password */}
        <div className="neobrutal-box bg-white p-6 shadow-[4px_4px_0px_#1D1D23]">
          <h3 className="text-lg font-extrabold text-[#1D1D23] mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#FF7F50]" /> Change Password
          </h3>
          <p className="text-sm text-gray-500 mb-4 font-medium">Leave empty if you don't want to change your password.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full py-3 px-4 pr-11 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1D1D23]"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full py-3 px-4 pr-11 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold transition-all"
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1D1D23]"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full py-3 px-4 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold transition-all"
                placeholder="Re-type new password"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="neobrutal-button px-8 py-3.5 bg-[#8A2BE2] text-white flex items-center gap-2 text-sm disabled:opacity-50 hover:bg-[#9b42ef]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
