'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi, frameTemplatesApi } from '@/lib/api';

type FrameTemplate = { id: number; name: string };
type EventPackage = { id: number; name: string; price: number; photo_count: number; is_active: boolean; description?: string; sort_order: number; frame_template_id?: number | null; print_count?: number };

export default function EditPackagePage() {
  const router = useRouter();
  const { eventId, packageId } = useParams();

  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    photo_count: '4',
    frame_template_id: '',
    is_active: true,
    sort_order: '0',
    session_duration: '3',
    print_count: '1'
  });

  useEffect(() => {
    // Load frame templates and all packages for this event to find the one we want to edit
    Promise.all([
      frameTemplatesApi.list().then((res: any) => res.data ?? res),
      eventsApi.adminGetEvent(Number(eventId)).then(event => eventsApi.getPackages(event.slug))
    ]).then(([templates, packages]) => {
      setFrameTemplates(templates);
      
      const pkg = packages.find((p: EventPackage) => p.id === Number(packageId));
      if (!pkg) {
        toast.error('Paket tidak ditemukan.');
        router.push(`/admin/events/${eventId}`);
        return;
      }

      setForm({
        name: pkg.name || '',
        description: pkg.description || '',
        price: String(pkg.price || ''),
        photo_count: String(pkg.photo_count || '4'),
        frame_template_id: pkg.frame_template_id ? String(pkg.frame_template_id) : '',
        is_active: pkg.is_active ?? true,
        sort_order: String(pkg.sort_order || '0'),
        session_duration: String(pkg.session_duration ? Math.round(pkg.session_duration / 60) : '3'), // seconds to minutes
        print_count: String(pkg.print_count ?? '1')
      });
      setIsLoading(false);
    }).catch((err) => {
      console.error(err);
      toast.error('Gagal memuat detail paket.');
      router.push(`/admin/events/${eventId}`);
    });
  }, [eventId, packageId, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.photo_count) {
      return toast.error('Nama paket, harga, dan jumlah foto wajib diisi.');
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || '',
        price: Number(form.price),
        photo_count: Number(form.photo_count),
        frame_template_id: form.frame_template_id ? Number(form.frame_template_id) : null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order),
        session_duration: Number(form.session_duration || '3') * 60, // convert minutes to seconds
        print_count: Number(form.print_count)
      };

      await eventsApi.adminUpdatePackage(Number(eventId), Number(packageId), payload);
      toast.success('Paket berhasil diperbarui!');
      router.push(`/admin/events/${eventId}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui paket.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#FFFDF7] p-6">
        <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin mb-4" />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Memuat Detail Paket...</p>
      </div>
    );
  }

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

        <h1 className="text-3xl font-black text-[#1D1D23] mb-6">Edit Paket</h1>

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
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Jumlah Cetak Fisik *</label>
              <input 
                type="number" 
                value={form.print_count} 
                onChange={e => setForm(p => ({ ...p, print_count: e.target.value }))} 
                placeholder="1" 
                min="0"
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
                required
              />
              <p className="text-[10px] text-gray-500 mt-1 font-semibold">0 = tidak bisa cetak</p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mt-2 select-none">
            <input 
              type="checkbox" 
              checked={form.is_active} 
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} 
              className="w-5 h-5 accent-[#8A2BE2]" 
            />
            <span className="text-sm font-bold text-[#1D1D23]">Aktifkan paket ini agar dapat dibeli peserta</span>
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
              disabled={isSaving}
              className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Paket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
