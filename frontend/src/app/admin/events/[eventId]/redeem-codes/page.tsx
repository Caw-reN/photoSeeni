'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Search, Copy, Check, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, XCircle, Ticket, Mail, Phone, User, ExternalLink, Printer, Info } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi } from '@/lib/api';

type EventPackage = { id: number; name: string; price: number; photo_count: number; is_active: boolean; print_count?: number };

type Event = {
  id: number; name: string; slug: string; organizer_name: string; is_active: boolean;
};

type RedeemCode = {
  id: number;
  code: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  payment_status: 'paid' | 'pending' | 'unpaid';
  payment_amount: number;
  is_used: boolean;
  used_at?: string;
  created_at: string;
  package?: { id: number; name: string; price: number; photo_count: number; print_count?: number };
  photo_session?: { id: number; final_image_path?: string; final_image_paths?: string[] };
};

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.startsWith('/')) return apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
  return '';
})();

type PaginatedRedeemCodes = {
  data: RedeemCode[];
  current_page: number;
  last_page: number;
  total: number;
};

export default function ManageRedeemCodesPage() {
  const router = useRouter();
  const { eventId } = useParams();

  const [event, setEvent] = useState<Event | null>(null);
  const [packages, setPackages] = useState<EventPackage[]>([]);
  const [paginatedData, setPaginatedData] = useState<PaginatedRedeemCodes | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isUsed, setIsUsed] = useState('');
  const [page, setPage] = useState(1);

  // Manual generation form state
  const [showGenForm, setShowGenForm] = useState(false);
  const [genForm, setGenForm] = useState({
    event_package_id: '',
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    quantity: 1,
    payment_status: 'paid' as 'paid' | 'unpaid' | 'pending'
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Clipboard copies mapping
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchRedeemCodes = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await eventsApi.adminListRedeemCodes(Number(eventId), {
        page,
        search: search || undefined,
        payment_status: paymentStatus || undefined,
        is_used: isUsed === '' ? undefined : isUsed === '1'
      });
      setPaginatedData(res);
    } catch {
      toast.error('Gagal memuat kode redeem.');
    } finally {
      setIsLoadingList(false);
    }
  }, [eventId, page, search, paymentStatus, isUsed]);

  useEffect(() => {
    // Load event, packages, and redeem codes on load
    Promise.all([
      eventsApi.adminGetEvent(Number(eventId)),
      eventsApi.adminGetEvent(Number(eventId)).then(eventRes => eventsApi.getPackages(eventRes.slug))
    ]).then(([eventRes, pkgsRes]) => {
      setEvent(eventRes);
      setPackages(pkgsRes);
      if (pkgsRes.length > 0) {
        setGenForm(f => ({ ...f, event_package_id: String(pkgsRes[0].id) }));
      }
    }).catch(() => {
      toast.error('Gagal memuat informasi event.');
      router.push('/admin/events');
    });
  }, [eventId, router]);

  useEffect(() => {
    fetchRedeemCodes();
  }, [fetchRedeemCodes]);

  const handleCopyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Kode redeem disalin ke papan klip.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkPaid = async (code: RedeemCode) => {
    if (!confirm(`Tandai kode "${code.code}" sebagai LUNAS?`)) return;
    try {
      await eventsApi.adminMarkRedeemCodePaid(Number(eventId), code.id);
      toast.success('Kode berhasil dilunasi.');
      fetchRedeemCodes();
    } catch (err: any) {
      toast.error(err.message || 'Gagal melunasi kode.');
    }
  };

  const handleDeleteCode = async (code: RedeemCode) => {
    if (!confirm(`Hapus kode redeem "${code.code}"?`)) return;
    try {
      await eventsApi.adminDeleteRedeemCode(Number(eventId), code.id);
      toast.success('Kode redeem dihapus.');
      fetchRedeemCodes();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus kode redeem.');
    }
  };

  const handlePrint = (code: RedeemCode) => {
    if (!code.photo_session) {
      toast.error('Data sesi foto tidak ditemukan.');
      return;
    }
    const paths = code.photo_session.final_image_paths || (code.photo_session.final_image_path ? [code.photo_session.final_image_path] : []);
    if (paths.length === 0) {
      toast.error('Gambar hasil foto belum tersedia.');
      return;
    }
    const printCount = code.package?.print_count || 1;
    let printPaths = [...paths];
    if (printPaths.length < printCount && printPaths.length > 0) {
        // If there's only 1 path but they want 3 prints, duplicate it
        if (printPaths.length === 1) {
            printPaths = Array(printCount).fill(printPaths[0]);
        }
    }
    const printUrls = printPaths.map(p => `${BACKEND_URL}/storage/${p}`);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela cetak. Periksa popup blocker.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Foto - ${code.code}</title>
          <style>
            body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 20px; background: #fff; }
            img { max-width: 100%; height: auto; page-break-inside: avoid; }
            @media print {
              @page { margin: 0; }
              html, body { margin: 0; padding: 0; height: 100%; }
              body { display: block; }
              img { 
                display: block; 
                max-width: 100%; 
                max-height: 99vh; 
                object-fit: contain; 
                page-break-inside: avoid; 
                page-break-after: always; 
                margin: 0 auto; 
              }
              img:last-child { page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          ${printUrls.map(url => `<img src="${url}" />`).join('')}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.event_package_id) {
      return toast.error('Pilih paket terlebih dahulu.');
    }

    setIsGenerating(true);
    try {
      const payload = {
        event_package_id: Number(genForm.event_package_id),
        buyer_name: genForm.buyer_name || undefined,
        buyer_email: genForm.buyer_email || undefined,
        buyer_phone: genForm.buyer_phone || undefined,
        quantity: Number(genForm.quantity),
        payment_status: genForm.payment_status
      };

      await eventsApi.adminCreateRedeemCodes(Number(eventId), payload);
      toast.success('Kode redeem berhasil digenerate!');
      setShowGenForm(false);
      setGenForm(f => ({ ...f, buyer_name: 'Manual Order', buyer_email: '', buyer_phone: '', quantity: 1, payment_status: 'paid' }));
      setPage(1); // reset to page 1 to see new codes
      fetchRedeemCodes();
    } catch (err: any) {
      toast.error(err.message || 'Gagal generate kode.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!event) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#FFFDF7] p-6">
        <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin mb-4" />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Memuat Informasi Event...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back navigation */}
        <button 
          onClick={() => router.push('/admin/events')}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#1D1D23] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke daftar event
        </button>

        {/* Internal Navigation Tabs */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          <button 
            onClick={() => router.push(`/admin/events/${event.id}`)}
            className="px-5 py-2.5 bg-white text-[#1D1D23] border-3 border-[#1D1D23] rounded-xl hover:bg-gray-50 shadow-[3px_3px_0px_#1D1D23] hover:shadow-[4px_4px_0px_#8A2BE2] font-black text-sm flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <Info className="w-4 h-4" /> Detail & Paket
          </button>
          <button className="px-5 py-2.5 bg-[#1D1D23] text-white border-3 border-[#1D1D23] rounded-xl shadow-[3px_3px_0px_#8A2BE2] font-black text-sm flex items-center gap-2 whitespace-nowrap">
            <Ticket className="w-4 h-4" /> Manajemen Redeem Codes
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b-3 border-[#1D1D23] pb-5">
          <div>
            <h1 className="text-3xl font-black text-[#1D1D23]">Kelola Kode Redeem</h1>
            <p className="text-gray-500 font-medium text-sm mt-1">{event.name} • {event.organizer_name}</p>
          </div>
          <button 
            onClick={() => setShowGenForm(!showGenForm)}
            className="flex items-center justify-center gap-2 px-5 py-3 border-3 border-[#1D1D23] rounded-2xl font-black text-sm bg-[#8A2BE2] text-white hover:opacity-95 shadow-[3px_3px_0px_#1D1D23] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> {showGenForm ? 'Tutup Panel Pembuatan' : 'Generate Kode Manual'}
          </button>
        </div>

        {/* Manual Code Generator Panel (Collapsible Card, No Modal) */}
        {showGenForm && (
          <div className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[5px_5px_0px_#1D1D23] p-6 mb-6">
            <h2 className="text-lg font-black text-[#1D1D23] mb-4 flex items-center gap-2"><Ticket className="w-5 h-5 text-[#8A2BE2]" /> Generate Kode Redeem Manual</h2>
            <form onSubmit={handleGenerateCodes} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Pilih Paket *</label>
                  <select 
                    value={genForm.event_package_id} 
                    onChange={e => setGenForm(p => ({ ...p, event_package_id: e.target.value }))} 
                    className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2] bg-white"
                    required
                  >
                    <option value="">Pilih paket event...</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString('id-ID')})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Nama Pembeli (Opsional)</label>
                  <input 
                    type="text" 
                    value={genForm.buyer_name} 
                    onChange={e => setGenForm(p => ({ ...p, buyer_name: e.target.value }))} 
                    placeholder="Contoh: Budi Santoso / Free Voucher" 
                    className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Email (Opsional)</label>
                    <input 
                      type="email" 
                      value={genForm.buyer_email} 
                      onChange={e => setGenForm(p => ({ ...p, buyer_email: e.target.value }))} 
                      placeholder="budi@email.com" 
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">WhatsApp (Opsional)</label>
                    <input 
                      type="text" 
                      value={genForm.buyer_phone} 
                      onChange={e => setGenForm(p => ({ ...p, buyer_phone: e.target.value }))} 
                      placeholder="62812345678" 
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3.5 justify-between">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Status Pembayaran *</label>
                    <select 
                      value={genForm.payment_status} 
                      onChange={e => setGenForm(p => ({ ...p, payment_status: e.target.value as any }))} 
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2] bg-white"
                      required
                    >
                      <option value="paid">Lunas (Paid)</option>
                      <option value="unpaid">Belum Bayar (Unpaid)</option>
                      <option value="pending">Menunggu (Pending)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Jumlah Kode *</label>
                    <input 
                      type="number" 
                      value={genForm.quantity} 
                      onChange={e => setGenForm(p => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))} 
                      min="1" 
                      max="100" 
                      className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                      required
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3.5 text-xs text-slate-500 font-bold leading-relaxed">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Catatan</p>
                  Generate kode redeem manual berguna untuk pemesanan offline, bonus, atau pengujian. Jika memilih status Lunas, kode tersebut langsung aktif dan bisa dipakai berfoto di photobooth.
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowGenForm(false)} 
                    className="flex-1 py-2.5 border-2 border-[#1D1D23] rounded-xl text-sm font-black hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isGenerating}
                    className="flex-1 py-2.5 border-2 border-[#1D1D23] rounded-xl text-sm font-black bg-[#8A2BE2] text-white hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />} Generate
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white border-3 border-[#1D1D23] rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23] mb-6 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Cari kode, nama pembeli, email, telepon..." 
              className="w-full pl-9 pr-4 py-2 border-2 border-[#1D1D23] rounded-xl text-xs font-bold focus:outline-none" 
            />
          </div>

          <div className="flex gap-3">
            <select 
              value={paymentStatus} 
              onChange={e => { setPaymentStatus(e.target.value); setPage(1); }} 
              className="border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-xs font-bold bg-white"
            >
              <option value="">Semua Pembayaran</option>
              <option value="paid">Lunas (Paid)</option>
              <option value="pending">Menunggu (Pending)</option>
              <option value="unpaid">Belum Bayar (Unpaid)</option>
            </select>

            <select 
              value={isUsed} 
              onChange={e => { setIsUsed(e.target.value); setPage(1); }} 
              className="border-2 border-[#1D1D23] rounded-xl px-3 py-2 text-xs font-bold bg-white"
            >
              <option value="">Semua Status Penggunaan</option>
              <option value="0">Belum Digunakan</option>
              <option value="1">Sudah Digunakan</option>
            </select>
          </div>
        </div>

        {/* Codes Table List */}
        {isLoadingList ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[#8A2BE2]" />
          </div>
        ) : !paginatedData || paginatedData.data.length === 0 ? (
          <div className="text-center py-16 bg-white border-3 border-dashed border-[#1D1D23] rounded-3xl font-black text-slate-400 uppercase tracking-widest text-xs">
            Tidak ada kode redeem yang cocok dengan kriteria pencarian
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedData.data.map(code => (
              <div 
                key={code.id}
                className="bg-white border-3 border-[#1D1D23] rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#8A2BE2] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono font-black text-[#1D1D23] text-sm bg-slate-100 border border-slate-300 rounded px-2.5 py-0.5 tracking-wider select-all">
                      {code.code}
                    </span>
                    <button 
                      onClick={() => handleCopyCode(code.id, code.code)}
                      className="p-1 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                      title="Salin Kode"
                    >
                      {copiedId === code.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    </button>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border flex items-center gap-1 ${
                      code.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-600' :
                      code.payment_status === 'pending' ? 'bg-amber-50 border-amber-300 text-amber-600' :
                      'bg-red-50 border-red-300 text-red-600'
                    }`}>
                      {code.payment_status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {code.payment_status === 'paid' ? 'LUNAS' : code.payment_status === 'pending' ? 'PENDING' : 'BELUM BAYAR'}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                      code.is_used ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-slate-50 border-slate-300 text-slate-500'
                    }`}>
                      {code.is_used ? 'SUDAH FOTO' : 'BELUM FOTO'}
                    </span>
                  </div>

                  <h3 className="font-black text-[#1D1D23] text-sm leading-tight flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> {code.buyer_name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 font-bold">
                    <span className="text-[#8A2BE2]">{code.package?.name || 'Paket Kustom'}</span>
                    <span>Rp {Number(code.payment_amount).toLocaleString('id-ID')}</span>
                    {code.buyer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{code.buyer_email}</span>}
                    {code.buyer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{code.buyer_phone}</span>}
                  </div>
                  {code.is_used && code.used_at && (
                    <p className="text-[10px] text-blue-500 font-bold mt-2">
                      Sesi foto digunakan pada: {new Date(code.used_at).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 md:self-center">
                  {code.payment_status !== 'paid' && (
                    <button 
                      onClick={() => handleMarkPaid(code)}
                      className="px-3.5 py-1.5 border-2 border-emerald-600 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Lunasi
                    </button>
                  )}
                  {code.is_used && (
                    <a 
                      href={`/result/event/${code.code}`}
                      target="_blank"
                      className="p-1.5 border-2 border-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-blue-600"
                      title="Lihat Hasil Foto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {code.is_used && code.package && (code.package.print_count ?? 0) > 0 && (
                    <button 
                      onClick={() => handlePrint(code)}
                      className="px-3.5 py-1.5 border-2 border-purple-600 rounded-lg text-xs font-black bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1"
                      title="Cetak Fisik"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteCode(code)}
                    className="p-1.5 border-2 border-red-200 rounded-lg bg-white hover:bg-red-50 transition-colors text-red-500"
                    title="Hapus Kode"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {paginatedData.last_page > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white border-3 border-[#1D1D23] rounded-xl p-4 shadow-[3px_3px_0px_#1D1D23]">
                <button 
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 border-2 border-[#1D1D23] rounded-lg text-xs font-black bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  Sebelumnya
                </button>
                <span className="text-xs font-black text-[#1D1D23]">Halaman {page} dari {paginatedData.last_page}</span>
                <button 
                  disabled={page >= paginatedData.last_page}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 border-2 border-[#1D1D23] rounded-lg text-xs font-black bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
