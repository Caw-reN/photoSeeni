'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi, frameTemplatesApi } from '@/lib/api';

type FrameTemplate = { id: number; name: string };

export default function CreatePackagePage() {
  const router = useRouter();
  const { eventId } = useParams();

  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    photo_count: '4',
    frame_template_id: '',
    is_active: true,
    sort_order: '0',
    session_duration: '3', // default 3 minutes (180 seconds)
    allow_print: true
  });

  useEffect(() => {
    frameTemplatesApi.list()
      .then((res: any) => setFrameTemplates(res.data ?? res))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.photo_count) {
      return toast.error('Nama paket, harga, dan jumlah foto wajib diisi.');
    }

    setIsLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        photo_count: Number(form.photo_count),
        frame_template_id: form.frame_template_id ? Number(form.frame_template_id) : null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order),
        session_duration: Number(form.session_duration || '3') * 60, // convert minutes to seconds
        allow_print: form.allow_print
      };

      await eventsApi.adminCreatePackage(Number(eventId), payload);
      toast.success('Paket ditambahkan!');
      router.push(`/admin/events/${eventId}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan paket.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-xl mx-auto">
        {/* Back navigation */}
        <button 
          onClick={() => router.push(`/admin/events/${eventId}`)}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#1D1D23] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Batal dan kembali ke detail event
        </button>

        <h1 className="text-3xl font-black text-[#1D1D23] mb-6">Tambah Paket Baru</h1>

        <form onSubmit={handleSave} className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[6px_6px_0px_#1D1D23] p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Nama Paket *</label>
            <input 
              type="text" 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="Contoh: Paket Premium Gold" 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              required
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Deskripsi</label>
            <input 
              type="text" 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              placeholder="Contoh: Cetak foto strip unlimited + file digital" 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Harga (Rp) *</label>
              <input 
                type="number" 
                value={form.price} 
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))} 
                placeholder="50000" 
                min="0"
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                required
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Jumlah Foto *</label>
              <input 
                type="number" 
                value={form.photo_count} 
                onChange={e => setForm(p => ({ ...p, photo_count: e.target.value }))} 
                placeholder="4" 
                min="1"
                max="20"
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Frame Template Khusus</label>
              <select 
                value={form.frame_template_id} 
                onChange={e => setForm(p => ({ ...p, frame_template_id: e.target.value }))} 
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2] bg-white text-xs sm:text-sm"
              >
                <option value="">Gunakan frame default event</option>
                {frameTemplates.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Urutan Sortir</label>
              <input 
                type="number" 
                value={form.sort_order} 
                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} 
                placeholder="0" 
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Durasi Sesi Foto (menit) *</label>
              <input 
                type="number" 
                value={form.session_duration} 
                onChange={e => setForm(p => ({ ...p, session_duration: e.target.value }))} 
                placeholder="3" 
                min="0.5"
                step="0.1"
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                required
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 cursor-pointer select-none pb-3">
                <input 
                  type="checkbox" 
                  checked={form.allow_print} 
                  onChange={e => setForm(p => ({ ...p, allow_print: e.target.checked }))} 
                  className="w-5 h-5 accent-[#8A2BE2]" 
                />
                <span className="text-sm font-bold text-[#1D1D23]">Bisa Cetak Fisik</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mt-2 select-none">
            <input 
              type="checkbox" 
              checked={form.is_active} 
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} 
              className="w-5 h-5 accent-[#8A2BE2]" 
            />
            <span className="text-sm font-bold text-[#1D1D23]">Aktifkan paket ini segera agar dapat dibeli peserta</span>
          </label>

          <div className="flex gap-4 mt-6">
            <button 
              type="button"
              onClick={() => router.push(`/admin/events/${eventId}`)} 
              className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-white text-[#1D1D23] hover:bg-slate-50 transition-colors shadow-[3px_3px_0px_#1D1D23] active:scale-95"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Tambah Paket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
