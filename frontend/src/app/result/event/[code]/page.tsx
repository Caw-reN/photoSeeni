'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, QrCode, Camera, Loader2, AlertCircle, CheckCircle2, Calendar, MapPin, Building2, Share2 } from 'lucide-react';
import { eventsApi } from '@/lib/api';
import { toast } from 'sonner';

type ResultData = {
  redeem_code: { code: string; buyer_name: string };
  event: { name: string; organizer_name: string; event_date?: string; location?: string };
  package: { name: string; photo_count: number };
  session: {
    id: number;
    final_image_path?: string;
    photos: { id: number; slot_index: number; file_path: string; url: string }[];
  };
  final_image_url?: string;
};

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.startsWith('/')) return apiUrl.replace('/api', '');
  return '';
})();

export default function EventResultPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [data, setData] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    eventsApi.getResult(code)
      .then(setData)
      .catch(err => setError(err.message || 'Hasil foto tidak ditemukan.'))
      .finally(() => setIsLoading(false));
  }, [code]);

  const handleDownload = async () => {
    if (!data?.final_image_url && !data?.session.final_image_path) {
      toast.error('Foto belum tersedia untuk didownload.');
      return;
    }
    const url = data.final_image_url
      || `${BACKEND_URL}/storage/${data.session.final_image_path}`;

    try {
      const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': '69420' } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fotoseeni-${data.redeem_code.code}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Foto berhasil didownload!');
    } catch {
      toast.error('Gagal mendownload foto.');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `Foto ${data?.event.name}`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link disalin!');
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#1D1D23] flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-[#8A2BE2]" />
      <p className="text-white font-bold">Memuat hasil foto...</p>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#1D1D23] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="w-16 h-16 text-red-400" />
      <h1 className="text-2xl font-black text-white">Hasil tidak ditemukan</h1>
      <p className="text-gray-400">{error}</p>
      <button onClick={() => router.push('/redeem')} className="mt-2 px-6 py-3 border-3 border-white rounded-xl font-black text-white hover:bg-white hover:text-[#1D1D23] transition-colors">
        Coba Kode Lain
      </button>
    </div>
  );

  const photoReady = !!data.final_image_url || !!data.session.final_image_path;

  return (
    <div className="min-h-screen bg-[#1D1D23] text-white">
      {/* Top Bar */}
      <div className="bg-[#8A2BE2] border-b-4 border-white/20 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-purple-200 mb-0.5">Hasil Foto Event</div>
            <h1 className="font-black text-lg text-white">{data.event.name}</h1>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-purple-200 font-medium">{data.event.organizer_name}</p>
            {data.event.event_date && (
              <p className="text-xs text-purple-200 flex items-center gap-1 justify-end mt-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(data.event.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[1fr_320px] gap-8">
          {/* Main: Photo Strip */}
          <div className="flex flex-col items-center gap-4">
            {photoReady ? (
              <>
                <img
                  src={data.final_image_url || `${BACKEND_URL}/storage/${data.session.final_image_path}`}
                  alt="Hasil Foto Strip"
                  className="w-full max-w-sm rounded-2xl border-4 border-white/20 shadow-2xl"
                />
                <div className="flex gap-3 w-full max-w-sm">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-3.5 rounded-xl font-black border-3 border-white bg-white text-[#1D1D23] hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" /> Download
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-1 py-3.5 rounded-xl font-black border-3 border-[#8A2BE2] bg-[#8A2BE2] text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-5 h-5" /> Bagikan
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full max-w-sm aspect-[3/4] rounded-2xl border-4 border-white/10 bg-white/5 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-[#8A2BE2]" />
                <p className="font-bold text-white/60 text-sm text-center">Foto sedang diproses...<br />Silakan refresh halaman beberapa saat lagi.</p>
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div className="flex flex-col gap-4">
            {/* Status Badge */}
            <div className={`border-3 rounded-2xl p-4 flex items-center gap-3 ${photoReady ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-400 bg-amber-400/10'}`}>
              {photoReady
                ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                : <Loader2 className="w-6 h-6 text-amber-400 animate-spin shrink-0" />
              }
              <div>
                <p className="font-black text-sm">{photoReady ? 'Foto Siap Didownload!' : 'Foto Sedang Diproses'}</p>
                <p className="text-xs text-white/60 font-medium mt-0.5">
                  {photoReady ? 'Klik tombol Download untuk menyimpan.' : 'Akan tersedia dalam beberapa menit.'}
                </p>
              </div>
            </div>

            {/* Buyer Info */}
            <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-white/50 mb-3">Informasi Peserta</h3>
              <p className="font-bold text-white">{data.redeem_code.buyer_name}</p>
              <p className="text-xs text-white/50 mt-1">{data.package.name} • {data.package.photo_count} foto</p>
            </div>

            {/* Event Info */}
            <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-white/50 mb-3">Informasi Event</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <Building2 className="w-4 h-4 shrink-0 text-[#8A2BE2]" />
                  <span>{data.event.organizer_name}</span>
                </div>
                {data.event.location && (
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <MapPin className="w-4 h-4 shrink-0 text-[#8A2BE2]" />
                    <span>{data.event.location}</span>
                  </div>
                )}
                {data.event.event_date && (
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <Calendar className="w-4 h-4 shrink-0 text-[#8A2BE2]" />
                    <span>{new Date(data.event.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Redeem code */}
            <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-white/50 mb-2">Kode Redeem</h3>
              <p className="font-mono font-black text-[#8A2BE2] tracking-widest text-sm">{data.redeem_code.code}</p>
              <p className="text-[10px] text-white/40 mt-1 font-medium">Gunakan kode ini di fotoseeni.com/redeem untuk mengakses hasil foto kapan saja.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
