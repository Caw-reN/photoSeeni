'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Camera, Search, AlertCircle, CheckCircle2, Loader2, Package, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi } from '@/lib/api';

type ValidateResult = {
  status: 'valid' | 'already_used' | 'invalid' | 'unpaid' | 'expired';
  message: string;
  result_url?: string;
  redeem_code?: { code: string; buyer_name: string; buyer_email?: string; buyer_phone?: string };
  event?: { name: string; slug: string; organizer_name: string };
  package?: { name: string; photo_count: number };
};

export default function RedeemPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // User input details state (for sending photos)
  const [userDetails, setUserDetails] = useState({
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
  });

  const handleValidate = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return toast.error('Masukkan kode redeem terlebih dahulu.');

    setIsValidating(true);
    setResult(null);
    try {
      const res = await eventsApi.validateCode(trimmed);
      setResult(res);
      if (res.status === 'valid' && res.redeem_code) {
        setUserDetails({
          buyer_name: res.redeem_code.buyer_name === 'Peserta' ? '' : (res.redeem_code.buyer_name || ''),
          buyer_email: res.redeem_code.buyer_email || '',
          buyer_phone: res.redeem_code.buyer_phone || '',
        });
      }
    } catch (err: any) {
      const status = err.message?.includes('tidak ditemukan') ? 'invalid'
        : err.message?.includes('dibayar') ? 'unpaid'
        : err.message?.includes('berakhir') ? 'expired'
        : 'invalid';
      setResult({ status, message: err.message || 'Kode tidak valid.' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartSession = async () => {
    const trimmed = code.trim().toUpperCase();
    
    // Client-side validation of user input details
    const name = userDetails.buyer_name.trim();
    const email = userDetails.buyer_email.trim();
    const phone = userDetails.buyer_phone.trim();

    if (!name) {
      return toast.error('Nama Lengkap wajib diisi.');
    }
    if (!email && !phone) {
      return toast.error('Mohon isi setidaknya email atau nomor WhatsApp untuk mengirimkan hasil foto.');
    }

    setIsStarting(true);
    try {
      const res = await eventsApi.startSession(trimmed, {
        buyer_name: name,
        buyer_email: email || undefined,
        buyer_phone: phone || undefined
      });
      // Store session info for booth
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_session_id', String(res.session.id));
        localStorage.setItem('event_redeem_code', trimmed);
        localStorage.setItem('event_session_start_time', String(Date.now()));
        localStorage.setItem('event_session_info', JSON.stringify({
          eventName: res.event?.name,
          packageName: res.package?.name,
          maxPhotos: res.package?.photo_count,
          frameId: res.session.frame_id,
          sessionDuration: res.session.session_duration,
        }));
      }
      toast.success('Sesi foto dimulai!');
      router.push(`/booth?redeem=${trimmed}&session=${res.session.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai sesi foto.');
      setIsStarting(false);
    }
  };

  const handleViewResult = () => {
    if (result?.result_url) router.push(result.result_url);
  };

  const statusColor = {
    valid: 'border-emerald-400 bg-emerald-50',
    already_used: 'border-blue-400 bg-blue-50',
    invalid: 'border-red-400 bg-red-50',
    unpaid: 'border-amber-400 bg-amber-50',
    expired: 'border-gray-400 bg-gray-50',
  };

  const statusIcon = {
    valid: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    already_used: <QrCode className="w-6 h-6 text-blue-500" />,
    invalid: <AlertCircle className="w-6 h-6 text-red-500" />,
    unpaid: <AlertCircle className="w-6 h-6 text-amber-500" />,
    expired: <AlertCircle className="w-6 h-6 text-gray-500" />,
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#8A2BE2] border-3 border-[#1D1D23] rounded-2xl shadow-[4px_4px_0px_#1D1D23] mb-4">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-[#1D1D23] tracking-tight">Redeem Kode</h1>
          <p className="text-gray-500 font-medium mt-2 text-sm">Masukkan kode redeem atau lihat hasil foto kamu</p>
        </div>

        {/* Input */}
        <div className="bg-white border-3 border-[#1D1D23] rounded-2xl p-5 shadow-[5px_5px_0px_#1D1D23]">
          <label className="text-xs font-black uppercase tracking-widest text-[#1D1D23] block mb-2">Kode Redeem</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleValidate()}
              placeholder="Contoh: SMA1JKT-ABCD1234"
              className="flex-1 border-2 border-[#1D1D23] rounded-xl px-3 py-3 font-mono text-sm font-bold tracking-widest focus:outline-none focus:border-[#8A2BE2] uppercase"
            />
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-3 border-3 border-[#1D1D23] rounded-xl bg-[#1D1D23] text-white font-black shadow-[3px_3px_0px_#8A2BE2] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0px_#8A2BE2] active:shadow-none transition-all disabled:opacity-60"
            >
              {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-2">Kode dikirim via email/WhatsApp setelah pembayaran berhasil.</p>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-4 border-3 rounded-2xl p-5 ${statusColor[result.status]} shadow-[4px_4px_0px_#1D1D23]`}>
            <div className="flex items-start gap-3">
              {statusIcon[result.status]}
              <div className="flex-1">
                <p className="font-black text-[#1D1D23] text-sm">{result.message}</p>

                {result.status === 'valid' && result.event && result.package && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="bg-white border-2 border-[#1D1D23] rounded-xl p-3">
                      <p className="text-xs font-black text-[#1D1D23] uppercase">{result.event.name}</p>
                      <p className="text-xs text-gray-500 font-medium">{result.event.organizer_name}</p>
                      <div className="flex items-center gap-2 mt-2 border-b-2 border-dashed border-slate-100 pb-2 mb-2">
                        <Package className="w-4 h-4 text-[#8A2BE2]" />
                        <span className="text-xs font-bold text-[#1D1D23]">{result.package.name} — {result.package.photo_count} foto</span>
                      </div>

                      {/* Participant Form Details */}
                      <div className="flex flex-col gap-2.5 mt-2">
                        <p className="text-[10px] font-black uppercase text-gray-400">Informasi Penerima Hasil Foto</p>
                        
                        <div>
                          <label className="text-[9px] font-black uppercase text-[#1D1D23] mb-1 block">Nama Lengkap *</label>
                          <input
                            type="text"
                            value={userDetails.buyer_name}
                            onChange={e => setUserDetails(p => ({ ...p, buyer_name: e.target.value }))}
                            placeholder="Nama panggilan / lengkap Anda"
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-[#8A2BE2]"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-black uppercase text-[#1D1D23] mb-1 block">WhatsApp (No. WA) *</label>
                            <input
                              type="text"
                              value={userDetails.buyer_phone}
                              onChange={e => setUserDetails(p => ({ ...p, buyer_phone: e.target.value }))}
                              placeholder="08123456789"
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-[#8A2BE2]"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-[#1D1D23] mb-1 block">Alamat Email *</label>
                            <input
                              type="email"
                              value={userDetails.buyer_email}
                              onChange={e => setUserDetails(p => ({ ...p, buyer_email: e.target.value }))}
                              placeholder="nama@email.com"
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-[#8A2BE2]"
                            />
                          </div>
                        </div>

                        <p className="text-[8.5px] text-gray-400 font-bold leading-tight mt-1">
                          * Tautan hasil foto akan dikirim otomatis. Wajib mengisi Nama & minimal salah satu kontak (WhatsApp / Email).
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStartSession}
                      disabled={isStarting}
                      className="w-full py-3 rounded-xl font-black border-3 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isStarting ? <><Loader2 className="w-4 h-4 animate-spin" /> Memulai...</> : <><Camera className="w-4 h-4" /> Mulai Sesi Foto!</>}
                    </button>
                  </div>
                )}

                {result.status === 'already_used' && (
                  <button
                    onClick={handleViewResult}
                    className="mt-3 w-full py-2.5 rounded-xl font-black border-2 border-blue-500 bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    Lihat Hasil Foto <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#1D1D23]/20" />
          <span className="text-xs font-black text-gray-400 uppercase">atau</span>
          <div className="flex-1 h-px bg-[#1D1D23]/20" />
        </div>

        <button onClick={() => router.push('/')} className="w-full py-3 rounded-xl border-3 border-[#1D1D23] bg-white text-[#1D1D23] font-black text-sm shadow-[3px_3px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px active:shadow-none transition-all">
          ← Kembali ke Home
        </button>
      </div>
    </div>
  );
}
