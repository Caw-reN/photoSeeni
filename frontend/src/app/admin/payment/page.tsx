'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { CreditCard, Loader2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPaymentPage() {
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [sessionPrice, setSessionPrice] = useState(25000);
  const [serviceFee, setServiceFee] = useState(1500);
  const [regularSessionsEnabled, setRegularSessionsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.getPaymentSettings();
        setPaymentEnabled(data.payment_enabled);
        if (data.session_price !== undefined) setSessionPrice(data.session_price);
        if (data.service_fee !== undefined) setServiceFee(data.service_fee);
        if (data.regular_sessions_enabled !== undefined) setRegularSessionsEnabled(data.regular_sessions_enabled);
      } catch (err) {
        console.error('Failed to load payment settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = async () => {
    const newState = !paymentEnabled;
    const action = newState ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} payments?`)) return;

    setSaving(true);
    try {
      const data = await adminApi.setPaymentSettings({ payment_enabled: newState });
      setPaymentEnabled(data.payment_enabled);
      toast.success(`Payments ${newState ? 'enabled' : 'disabled'} successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment settings.');
    }
    setSaving(false);
  };

  const handleToggleRegularSessions = async () => {
    const newState = !regularSessionsEnabled;
    const action = newState ? 'mengaktifkan' : 'menonaktifkan';
    if (!confirm(`Apakah Anda yakin ingin ${action} sesi reguler? ${!newState ? 'User tidak akan bisa memulai sesi foto sendiri.' : ''}`)) return;

    setSaving(true);
    try {
      const data = await adminApi.setPaymentSettings({ regular_sessions_enabled: newState });
      setRegularSessionsEnabled(data.regular_sessions_enabled);
      toast.success(`Sesi reguler ${newState ? 'diaktifkan' : 'dinonaktifkan'}!`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah pengaturan sesi reguler.');
    }
    setSaving(false);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await adminApi.setPaymentSettings({
        session_price: Number(sessionPrice),
        service_fee: Number(serviceFee)
      });
      if (data.session_price !== undefined) setSessionPrice(data.session_price);
      if (data.service_fee !== undefined) setServiceFee(data.service_fee);
      toast.success('Pricing updated successfully! 💰');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update pricing.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-[#1D1D23]">💰 Payment Settings</h2>

      {/* Toggle Card */}
      <div className={`neobrutal-box p-8 shadow-[6px_6px_0px_#1D1D23] transition-colors ${
        paymentEnabled ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Status Icon */}
          <div className={`p-4 rounded-2xl border-3 border-[#1D1D23] ${
            paymentEnabled ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {paymentEnabled ? (
              <CheckCircle className="w-10 h-10 text-green-600" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-red-500" />
            )}
          </div>

          {/* Status Text */}
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black text-[#1D1D23] mb-1">
              Payments are {paymentEnabled ? 'Enabled' : 'Disabled'}
            </h3>
            <p className="text-gray-600 font-medium">
              {paymentEnabled
                ? 'Users are required to complete QRIS payment before downloading their photos.'
                : 'Payment is currently disabled. Users can download photos without paying.'
              }
            </p>
          </div>

          {/* Toggle Button */}
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`neobrutal-button px-8 py-4 flex items-center gap-3 text-lg font-black disabled:opacity-50 transition-colors ${
              paymentEnabled
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {saving ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : paymentEnabled ? (
              <ToggleRight className="w-6 h-6" />
            ) : (
              <ToggleLeft className="w-6 h-6" />
            )}
            {paymentEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Regular Sessions Toggle Card */}
      <div className={`neobrutal-box p-6 shadow-[6px_6px_0px_#1D1D23] transition-colors ${
        regularSessionsEnabled ? 'bg-blue-50' : 'bg-orange-50'
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className={`p-4 rounded-2xl border-3 border-[#1D1D23] ${
            regularSessionsEnabled ? 'bg-blue-100' : 'bg-orange-100'
          }`}>
            {regularSessionsEnabled ? (
              <CheckCircle className="w-10 h-10 text-blue-600" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-orange-500" />
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-black text-[#1D1D23] mb-1">
              Sesi Reguler {regularSessionsEnabled ? 'Aktif' : 'Dinonaktifkan'}
            </h3>
            <p className="text-gray-600 font-medium text-sm">
              {regularSessionsEnabled
                ? 'User dapat memulai sesi foto reguler mandiri melalui dashboard atau beranda.'
                : '⚠️ Mode Event Aktif: User tidak bisa memulai sesi foto sendiri. Hanya bisa menggunakan kode redeem event.'
              }
            </p>
          </div>
          <button
            onClick={handleToggleRegularSessions}
            disabled={saving}
            className={`neobrutal-button px-6 py-3.5 flex items-center gap-3 font-black disabled:opacity-50 transition-colors ${
              regularSessionsEnabled
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : regularSessionsEnabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {regularSessionsEnabled ? 'Nonaktifkan (Event Mode)' : 'Aktifkan Kembali'}
          </button>
        </div>
      </div>

      {/* Pricing Settings */}
      <div className="neobrutal-box bg-white p-6 md:p-8 shadow-[6px_6px_0px_#1D1D23]">
        <h3 className="text-xl font-black text-[#1D1D23] mb-6 border-b-2 border-[#1D1D23] pb-2 uppercase">Pricing Configuration</h3>
        <form onSubmit={handleSavePricing} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-2 uppercase">Session Price (Rp)</label>
              <input
                type="number"
                min="0"
                value={sessionPrice}
                onChange={(e) => setSessionPrice(Number(e.target.value))}
                required
                className="w-full py-3 px-4 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-black text-lg transition-all"
              />
              <p className="text-xs text-gray-500 font-bold mt-1.5">The main price for each photo session.</p>
            </div>
            <div>
              <label className="block text-sm font-extrabold text-[#1D1D23] mb-2 uppercase">Service Fee (Rp)</label>
              <input
                type="number"
                min="0"
                value={serviceFee}
                onChange={(e) => setServiceFee(Number(e.target.value))}
                required
                className="w-full py-3 px-4 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-black text-lg transition-all"
              />
              <p className="text-xs text-gray-500 font-bold mt-1.5">Additional platform or payment gateway fee.</p>
            </div>
          </div>
          
          <div className="pt-4 flex justify-between items-center border-t-3 border-dashed border-gray-200">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase">Total User Pays</p>
              <p className="text-2xl font-black text-[#8A2BE2]">Rp {(sessionPrice + serviceFee).toLocaleString('id-ID')}</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="neobrutal-button px-8 py-3.5 bg-[#FF7F50] text-[#1D1D23] font-black uppercase text-sm tracking-wide disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Pricing
            </button>
          </div>
        </form>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="neobrutal-box bg-white p-5 shadow-[4px_4px_0px_#1D1D23]">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-[#8A2BE2]" />
            <h4 className="text-sm font-extrabold text-[#1D1D23]">When Enabled</h4>
          </div>
          <ul className="space-y-2 text-sm text-gray-600 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Users must pay via QRIS before accessing the photo strip
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Payment gateway (Paymentku) must be configured with valid API keys
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Transaction records are created for each session
            </li>
          </ul>
        </div>
        <div className="neobrutal-box bg-white p-5 shadow-[4px_4px_0px_#1D1D23]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-[#FF7F50]" />
            <h4 className="text-sm font-extrabold text-[#1D1D23]">When Disabled</h4>
          </div>
          <ul className="space-y-2 text-sm text-gray-600 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">⚠</span>
              Users can download photos immediately without payment
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">⚠</span>
              No revenue is generated from photo sessions
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">⚠</span>
              Useful for testing, demos, or free events
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
