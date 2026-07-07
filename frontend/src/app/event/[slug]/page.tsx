'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Camera, Package, CheckCircle2, Loader2, QrCode, AlertCircle, ArrowLeft, ArrowRight, MapPin, Calendar, Building2, ShieldCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi } from '@/lib/api';

type EventPackage = {
  id: number;
  name: string;
  description?: string;
  price: number;
  photo_count: number;
  frame_template?: { name: string } | null;
};

type EventInfo = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  organizer_name: string;
  location?: string;
  event_date?: string;
  packages: EventPackage[];
};

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Purchase flow state
  const [step, setStep] = useState<'package' | 'details'>('package');
  const [selectedPackage, setSelectedPackage] = useState<EventPackage | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentQrString, setPaymentQrString] = useState<string | null>(null);
  const [purchasedCode, setPurchasedCode] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'qr' | 'success'>('qr');
  const [countdown, setCountdown] = useState(600);
  const [pollingCode, setPollingCode] = useState<string | null>(null);

  useEffect(() => {
    eventsApi.getEvent(slug)
      .then(setEvent)
      .catch(() => setError('Event tidak ditemukan atau sudah berakhir.'))
      .finally(() => setIsLoading(false));
  }, [slug]);

  // Countdown timer
  useEffect(() => {
    if (!showPaymentModal || paymentStep !== 'qr') return;
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [showPaymentModal, paymentStep]);

  // Poll payment status
  useEffect(() => {
    if (!pollingCode || paymentStep !== 'qr') return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await eventsApi.checkPurchaseStatus(pollingCode);
        if (stopped) return;
        if (res.payment_status === 'paid') {
          stopped = true;
          setPaymentStep('success');
        } else if (!['pending', 'unpaid'].includes(res.payment_status)) {
          toast.error(`Pembayaran gagal: ${res.payment_status}`);
          setShowPaymentModal(false);
          stopped = true;
        }
      } catch { /* silent */ }
    };
    const interval = setInterval(poll, 3000);
    poll();
    return () => { stopped = true; clearInterval(interval); };
  }, [pollingCode, paymentStep]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handlePurchase = async () => {
    if (!selectedPackage) return toast.error('Pilih paket terlebih dahulu.');
    if (!buyerName.trim()) return toast.error('Nama wajib diisi.');
    if (!buyerEmail.trim() && !buyerPhone.trim()) return toast.error('Email atau nomor WhatsApp wajib diisi.');

    setIsPurchasing(true);
    try {
      const res = await eventsApi.purchase(slug, {
        event_package_id: selectedPackage.id,
        buyer_name: buyerName,
        buyer_email: buyerEmail || undefined,
        buyer_phone: buyerPhone || undefined,
        return_url: window.location.origin + `/event/${slug}`,
      });

      if (res.status === 'success') {
        setPaymentQrUrl(res.payment_info?.qr_url || null);
        setPaymentQrString(res.payment_info?.qr_string || null);
        setPurchasedCode(res.code);
        setPollingCode(res.code);
        setCountdown(600);
        setPaymentStep('qr');
        setShowPaymentModal(true);
      } else {
        toast.error(res.message || 'Gagal memulai pembayaran.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleGoToBooth = async () => {
    if (!purchasedCode) return;
    setIsPurchasing(true);
    try {
      const res = await eventsApi.startSession(purchasedCode);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_session_id', String(res.session.id));
        localStorage.setItem('event_redeem_code', purchasedCode);
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
      router.push(`/booth?redeem=${purchasedCode}&session=${res.session.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai sesi foto.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-[#8A2BE2]" />
    </div>
  );

  if (error || !event) return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="w-16 h-16 text-red-400" />
      <h1 className="text-2xl font-black text-[#1D1D23]">{error || 'Event tidak ditemukan.'}</h1>
      <button onClick={() => router.push('/')} className="neobrutal-button px-6 py-3 bg-[#8A2BE2] text-white">Kembali ke Home</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* Header */}
      <div className="bg-[#8A2BE2] border-b-4 border-[#1D1D23] py-10 px-6 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 border border-white/40 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Camera className="w-3.5 h-3.5" /> Photobooth Event
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">{event.name}</h1>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold text-white/80 mt-4">
            <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" />{event.organizer_name}</span>
            {event.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.location}</span>}
            {event.event_date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{new Date(event.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          </div>
          {event.description && <p className="mt-4 text-white/70 max-w-xl mx-auto text-sm">{event.description}</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full border-3 border-[#1D1D23] flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#1D1D23] ${
              step === 'package' ? 'bg-[#8A2BE2] text-white' : 'bg-emerald-400 text-[#1D1D23]'
            }`}>
              {step === 'package' ? '1' : '✓'}
            </span>
            <span className="font-black text-xs md:text-sm text-[#1D1D23] uppercase tracking-wide">Pilih Paket</span>
          </div>
          <div className="w-8 md:w-16 h-1 bg-[#1D1D23] rounded"></div>
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full border-3 border-[#1D1D23] flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#1D1D23] ${
              step === 'details' ? 'bg-[#8A2BE2] text-white' : 'bg-white text-gray-400'
            }`}>
              2
            </span>
            <span className={`font-black text-xs md:text-sm uppercase tracking-wide ${step === 'details' ? 'text-[#1D1D23]' : 'text-gray-400'}`}>Data Diri</span>
          </div>
        </div>

        {step === 'package' ? (
          <div className="flex flex-col gap-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#1D1D23] mb-2 uppercase tracking-tight text-center">Pilih Paket Foto</h2>
              <p className="text-sm text-gray-500 font-bold text-center mb-8">Silakan pilih paket terbaik untuk mengabadikan momen serumu!</p>
              
              <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto">
                {event.packages.map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full sm:w-[280px] md:w-[300px] cursor-pointer flex flex-col justify-between p-6 border-4 rounded-2xl transition-all shadow-[6px_6px_0px_#1D1D23] hover:-translate-y-1.5 hover:shadow-[10px_10px_0px_#1D1D23] active:translate-y-0 active:shadow-[4px_4px_0px_#1D1D23] ${
                      selectedPackage?.id === pkg.id
                        ? 'border-[#8A2BE2] bg-purple-50/50'
                        : 'border-[#1D1D23] bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 bg-purple-100 border-2 border-[#1D1D23] rounded-full text-[10px] font-black text-[#8A2BE2] uppercase">
                          {pkg.photo_count} Slot Foto
                        </span>
                        {selectedPackage?.id === pkg.id && (
                          <span className="bg-[#8A2BE2] text-white p-1 rounded-full border-2 border-[#1D1D23]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-black text-[#1D1D23] mb-2">{pkg.name}</h3>
                      {pkg.description ? (
                        <p className="text-xs text-gray-600 mb-4 leading-relaxed font-semibold">
                          {pkg.description}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mb-4 italic font-medium">Tidak ada deskripsi paket.</p>
                      )}
                      
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{pkg.photo_count}x Cetak Frame Foto</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="truncate">{pkg.frame_template?.name ?? 'Frame Event Eksklusif'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>Unduh File Digital (QR Code)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="border-t-2 border-dashed border-[#1D1D23] pt-4 mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Harga Paket</p>
                        <p className="text-2xl font-black text-[#8A2BE2]">
                          Rp {pkg.price.toLocaleString('id-ID')}
                        </p>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPackage(pkg);
                          setStep('details');
                        }}
                        className={`w-full py-3 rounded-xl font-black text-sm border-3 border-[#1D1D23] transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_#1D1D23] active:shadow-none hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0px_#1D1D23] ${
                          selectedPackage?.id === pkg.id
                            ? 'bg-[#8A2BE2] text-white'
                            : 'bg-white text-[#1D1D23] hover:bg-gray-50'
                        }`}
                      >
                        Pilih & Lanjut <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPackage && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setStep('details')}
                  className="px-8 py-4 rounded-2xl font-black text-base md:text-lg border-4 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[6px_6px_0px_#1D1D23] hover:-translate-y-1 hover:shadow-[8px_8px_0px_#1D1D23] active:translate-y-0 active:shadow-[4px_4px_0px_#1D1D23] transition-all flex items-center gap-2"
                >
                  Lanjut ke Data Diri ({selectedPackage.name}) <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Redeem info */}
            <div className="max-w-4xl mx-auto w-full mt-4 bg-amber-50 border-3 border-[#1D1D23] rounded-2xl p-6 shadow-[4px_4px_0px_#1D1D23]">
              <h3 className="font-black text-[#1D1D23] text-lg mb-2 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-500" />
                Sudah punya Kode Redeem?
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-4">
                Jika kamu sudah membeli paket sebelumnya dan mendapatkan kode redeem, kamu bisa langsung masuk ke booth melalui halaman redeem.
              </p>
              <button
                onClick={() => router.push('/redeem')}
                className="w-full sm:w-auto px-6 py-3 bg-amber-400 text-[#1D1D23] border-3 border-[#1D1D23] rounded-xl font-black text-sm shadow-[3px_3px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0px_#1D1D23] active:shadow-none transition-all flex items-center justify-center gap-2"
              >
                Masukkan Kode Redeem →
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <button
              onClick={() => setStep('package')}
              className="inline-flex items-center gap-2 font-black text-[#1D1D23] mb-6 hover:text-[#8A2BE2] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Kembali ke Pilih Paket
            </button>

            <div className="grid md:grid-cols-5 gap-8 items-start">
              {/* Left Side: Summary (2 cols) */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-black text-[#1D1D23] uppercase tracking-wider">Paket Terpilih</h3>
                
                {selectedPackage && (
                  <div className="border-4 border-[#1D1D23] rounded-2xl p-5 bg-purple-50/30 shadow-[4px_4px_0px_#1D1D23] relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[#8A2BE2] text-white px-3 py-1 border-b-2 border-l-2 border-[#1D1D23] text-[10px] font-black rounded-bl-xl uppercase">
                      Terpilih
                    </div>
                    <h4 className="text-xl font-black text-[#1D1D23] mb-1">{selectedPackage.name}</h4>
                    <p className="text-xs text-gray-500 font-bold mb-4">
                      {selectedPackage.photo_count} Slot Foto • {selectedPackage.frame_template?.name ?? 'Frame Event'}
                    </p>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Cetak & File Digital</span>
                      </div>
                      {selectedPackage.description && (
                        <p className="text-xs text-gray-500 font-medium pl-5">{selectedPackage.description}</p>
                      )}
                    </div>
                    
                    <div className="border-t-2 border-[#1D1D23] pt-4 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400 uppercase">Total Bayar</span>
                      <span className="text-xl font-black text-[#8A2BE2]">Rp {selectedPackage.price.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                <div className="border-3 border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50/50 text-xs text-gray-500 font-medium">
                  <p className="font-bold mb-1 text-gray-600">Info Pembayaran:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Pembayaran instan menggunakan QRIS (GoPay, OVO, Dana, LinkAja, BCA, dll).</li>
                    <li>Kode redeem akan langsung muncul setelah pembayaran sukses.</li>
                    <li>Gunakan kode redeem tersebut untuk mulai berfoto di booth.</li>
                  </ul>
                </div>
              </div>

              {/* Right Side: Form (3 cols) */}
              <div className="md:col-span-3">
                <h3 className="text-sm font-black text-[#1D1D23] uppercase tracking-wider mb-4">Lengkapi Data Diri</h3>
                <div className="bg-white border-4 border-[#1D1D23] rounded-2xl p-6 shadow-[6px_6px_0px_#1D1D23] flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-black text-[#1D1D23] uppercase tracking-wide block mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={e => setBuyerName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#8A2BE2] focus:ring-2 focus:ring-[#8A2BE2]/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-[#1D1D23] uppercase tracking-wide block mb-1">
                      Email <span className="text-gray-400 font-normal normal-case">(untuk kirim link hasil foto)</span>
                    </label>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={e => setBuyerEmail(e.target.value)}
                      placeholder="contoh@email.com"
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#8A2BE2] focus:ring-2 focus:ring-[#8A2BE2]/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-[#1D1D23] uppercase tracking-wide block mb-1">
                      No. WhatsApp <span className="text-gray-400 font-normal normal-case">(opsional)</span>
                    </label>
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={e => setBuyerPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#8A2BE2] focus:ring-2 focus:ring-[#8A2BE2]/10"
                    />
                  </div>

                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing || !selectedPackage}
                    className="w-full py-4 mt-2 rounded-xl font-black text-base border-3 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0px_#1D1D23] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPurchasing ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
                    ) : (
                      <><QrCode className="w-5 h-5" /> Beli & Bayar QRIS</>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Pembayaran aman via QRIS GPN
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#FFFDF7] border-4 border-[#1D1D23] rounded-3xl shadow-[8px_8px_0px_#1D1D23] p-6 max-w-sm w-full flex flex-col gap-4 relative">
            {paymentStep === 'qr' && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-[#1D1D23] text-lg">Scan QRIS</h3>
                  <span className="text-amber-600 font-bold text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{formatTime(countdown)}</span>
                </div>
                <div className="bg-white border-3 border-[#1D1D23] rounded-2xl p-4 flex flex-col items-center gap-3">
                  <span className="text-xs font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">QRIS GPN NASIONAL</span>
                  <div className="w-48 h-48 border-2 border-[#1D1D23] rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    {paymentQrUrl
                      ? <img src={paymentQrUrl} alt="QRIS" className="w-full h-full object-contain" />
                      : <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
                    }
                  </div>
                  <p className="text-[10px] text-center text-gray-500 font-bold uppercase">Scan via GoPay, OVO, Dana, LinkAja, BCA</p>
                </div>
                <p className="text-xs text-center text-gray-500 font-medium">Menunggu konfirmasi pembayaran...</p>
              </>
            )}

            {paymentStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <h3 className="font-black text-[#1D1D23] text-xl">Pembayaran Berhasil! 🎉</h3>
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 w-full">
                  <p className="text-xs font-black text-[#1D1D23] uppercase mb-2">Kode Redeem Kamu:</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-[#8A2BE2] text-lg tracking-widest">{purchasedCode}</span>
                    <button onClick={() => { navigator.clipboard.writeText(purchasedCode!); toast.success('Disalin!'); }} className="p-1.5 border-2 border-[#1D1D23] rounded-lg bg-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium mt-2">Simpan kode ini! Link hasil foto akan dikirim ke email/WA kamu setelah sesi selesai.</p>
                </div>
                <button onClick={handleGoToBooth} className="w-full py-3.5 rounded-xl font-black border-3 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5" /> Mulai Sesi Foto →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
