'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi, frameTemplatesApi } from '@/lib/api';

const BACKEND_URL = (() => {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (u && !u.startsWith('/')) return u.replace(/\/api\/?$/, '');
  return '';
})();

const proxyImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  const abs = url.startsWith('http') ? url : `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  return `/api/proxy-image?url=${encodeURIComponent(abs)}`;
};

type FrameTemplate = { id: number; name: string; is_bw?: boolean; image_url?: string };

export default function EditEventPage() {
  const router = useRouter();
  const { eventId } = useParams();
  
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    organizer_name: '',
    description: '',
    location: '',
    event_date: '',
    expires_at: '',
    is_active: true
  });

  useEffect(() => {
    // Load frame templates and event details in parallel
    Promise.all([
      frameTemplatesApi.list().then((res: any) => res.data ?? res),
      eventsApi.adminGetEvent(Number(eventId))
    ]).then(([templates, event]) => {
      setFrameTemplates(templates);
      setForm({
        name: event.name || '',
        organizer_name: event.organizer_name || '',
        description: event.description || '',
        location: event.location || '',
        event_date: event.event_date || '',
        expires_at: event.expires_at ? event.expires_at.slice(0, 16) : '',
        is_active: event.is_active ?? true
      });
      // Pre-fill selected frame templates from pivot
      if (Array.isArray(event.frame_templates)) {
        setSelectedFrameIds(event.frame_templates.map((f: any) => f.id));
      }
      setIsLoading(false);
    }).catch((err) => {
      console.error(err);
      toast.error('Gagal memuat detail event.');
      router.push('/admin/events');
    });
  }, [eventId, router]);

  const toggleFrame = (id: number) => {
    setSelectedFrameIds(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.organizer_name) {
      return toast.error('Nama event dan penyelenggara wajib diisi.');
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        organizer_name: form.organizer_name,
        description: form.description || '',
        location: form.location || '',
        event_date: form.event_date || '',
        frame_template_ids: selectedFrameIds,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };

      await eventsApi.adminUpdateEvent(Number(eventId), payload);
      toast.success('Event berhasil diperbarui!');
      router.push('/admin/events');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui event.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#FFFDF7] p-6">
        <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin mb-4" />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Memuat Detail Event...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-[#1D1D23] mb-6">Edit Event</h1>

        <form onSubmit={handleSave} className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[6px_6px_0px_#1D1D23] p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Nama Event *</label>
            <input 
              type="text" 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="Contoh: Foto Wisuda SMA 1 Jakarta 2025" 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              required
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Penyelenggara *</label>
            <input 
              type="text" 
              value={form.organizer_name} 
              onChange={e => setForm(p => ({ ...p, organizer_name: e.target.value }))} 
              placeholder="Contoh: SMA Negeri 1 Jakarta" 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              required
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Lokasi</label>
            <input 
              type="text" 
              value={form.location} 
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))} 
              placeholder="Contoh: Aula Utama Sekolah" 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Deskripsi</label>
            <textarea 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              placeholder="Tulis deskripsi atau informasi event..."
              rows={3} 
              className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2] resize-none" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Tanggal Event</label>
              <input 
                type="date" 
                value={form.event_date} 
                onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} 
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-[#1D1D23] mb-1.5 block">Waktu Kadaluarsa</label>
              <input 
                type="datetime-local" 
                value={form.expires_at} 
                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} 
                className="w-full border-2 border-[#1D1D23] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
              />
            </div>
          </div>

          {/* Multi-Frame Template Selector */}
          <div>
            <label className="text-xs font-black uppercase text-[#1D1D23] mb-2 block">
              Frame Template yang Diizinkan
              <span className="ml-2 text-[#8A2BE2] normal-case font-bold">({selectedFrameIds.length} dipilih)</span>
            </label>
            <p className="text-[10px] text-gray-400 font-medium mb-3">
              Peserta hanya bisa memilih frame yang dicentang. Jika tidak ada yang dipilih, semua frame aktif tersedia.
            </p>
            {frameTemplates.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium py-2">Belum ada frame template.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto border-2 border-[#1D1D23] rounded-xl p-3">
                {frameTemplates.map(f => {
                  const selected = selectedFrameIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFrame(f.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-left cursor-pointer ${
                        selected
                          ? 'border-[#8A2BE2] bg-violet-50 shadow-[2px_2px_0px_#8A2BE2]'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      {/* Checkmark */}
                      <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        selected ? 'bg-[#8A2BE2] border-[#8A2BE2]' : 'border-slate-300 bg-white'
                      }`}>
                        {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      {/* Frame thumbnail */}
                      {f.image_url ? (
                        <img
                          src={proxyImageUrl(f.image_url)}
                          alt={f.name}
                          className="w-full h-16 object-contain rounded-lg"
                          style={f.is_bw ? { filter: 'grayscale(1)' } : {}}
                        />
                      ) : (
                        <div className="w-full h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                          <span className="text-slate-300 text-[10px]">No img</span>
                        </div>
                      )}
                      <span className="text-[10px] font-black text-[#1D1D23] text-center leading-tight line-clamp-2 w-full">
                        {f.name}
                      </span>
                      {f.is_bw && (
                        <span className="text-[8px] font-black bg-[#1D1D23] text-white px-1.5 py-0.5 rounded tracking-widest">B&W</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer mt-2 select-none">
            <input 
              type="checkbox" 
              checked={form.is_active} 
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} 
              className="w-5 h-5 accent-[#8A2BE2]" 
            />
            <span className="text-sm font-bold text-[#1D1D23]">Aktifkan event ini agar dapat diakses peserta</span>
          </label>

          <div className="flex gap-4 mt-6">
            <button 
              type="button"
              onClick={() => router.push('/admin/events')} 
              className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-white text-[#1D1D23] hover:bg-slate-50 transition-colors shadow-[3px_3px_0px_#1D1D23] active:scale-95"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
