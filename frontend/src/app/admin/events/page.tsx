'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, ChevronRight, Loader2, Search, ToggleLeft, ToggleRight, Package, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi } from '@/lib/api';

type Event = {
  id: number; name: string; slug: string; organizer_name: string;
  location?: string; event_date?: string; is_active: boolean;
  description?: string; expires_at?: string;
  frame_template_id?: number | null;
  packages_count: number; redeem_codes_count: number; photo_sessions_count: number;
};

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await eventsApi.adminListEvents({ search: search || undefined });
      setEvents(res.data ?? res);
    } catch {
      toast.error('Gagal memuat daftar event.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Hapus event ini? Semua paket dan kode redeem akan ikut terhapus.')) return;
    try {
      await eventsApi.adminDeleteEvent(id);
      toast.success('Event dihapus.');
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleActive = async (e: Event) => {
    try {
      await eventsApi.adminUpdateEvent(e.id, { is_active: !e.is_active });
      toast.success(e.is_active ? 'Event dinonaktifkan.' : 'Event diaktifkan.');
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#1D1D23]">Manajemen Event</h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Kelola event, paket, dan kode redeem peserta</p>
          </div>
          <button 
            onClick={() => router.push('/admin/events/create')} 
            className="neobrutal-button px-5 py-2.5 bg-[#8A2BE2] text-white text-sm font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Buat Event
          </button>
        </div>

        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Cari event..." 
              className="w-full pl-9 pr-4 py-2.5 border-3 border-[#1D1D23] rounded-xl text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" 
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-bold">
              Belum ada event. Buat event pertama kamu!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map(event => (
                <div 
                  key={event.id} 
                  className="bg-white border-3 border-[#1D1D23] rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23] cursor-pointer transition-all duration-200 hover:shadow-[5px_5px_0px_#8A2BE2] hover:border-[#8A2BE2] hover:scale-[1.005]" 
                  onClick={() => router.push(`/admin/events/${event.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${event.is_active ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                          {event.is_active ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                        {event.event_date && (
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(event.event_date).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-[#1D1D23] text-base leading-tight truncate">{event.name}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {event.organizer_name}{event.location ? ` • ${event.location}` : ''}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-gray-500 font-bold">
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{event.packages_count} paket</span>
                        <span className="flex items-center gap-1"><QrCode className="w-3 h-3" />{event.redeem_codes_count} kode</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={e => { e.stopPropagation(); router.push(`/admin/events/${event.id}/edit`); }} 
                        className="p-1.5 border-2 border-[#1D1D23] rounded-lg bg-white hover:bg-slate-50 transition-colors"
                        title="Edit Event"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleToggleActive(event); }} 
                        className="p-1.5 border-2 border-[#1D1D23] rounded-lg bg-white hover:bg-slate-50 transition-colors"
                        title={event.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {event.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDeleteEvent(event.id); }} 
                        className="p-1.5 border-2 border-red-200 rounded-lg bg-white hover:bg-red-50 transition-colors"
                        title="Hapus Event"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
