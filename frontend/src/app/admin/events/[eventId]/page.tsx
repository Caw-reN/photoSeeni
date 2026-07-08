'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Loader2, Package, QrCode, MapPin, Calendar, Info, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi } from '@/lib/api';

type Event = {
  id: number; name: string; slug: string; organizer_name: string;
  location?: string; event_date?: string; is_active: boolean;
  description?: string; expires_at?: string;
  frame_template_id?: number | null;
  packages_count: number; redeem_codes_count: number; photo_sessions_count: number;
};

type EventPackage = { id: number; name: string; price: number; photo_count: number; is_active: boolean; description?: string; sort_order: number };

type EventStats = {
  total_codes: number; paid_codes: number; used_codes: number;
  pending_codes: number; unused_paid_codes: number; revenue: number; completed_sessions: number;
};

export default function EventDetailPage() {
  const router = useRouter();
  const { eventId } = useParams();

  const [event, setEvent] = useState<Event | null>(null);
  const [eventPackages, setEventPackages] = useState<EventPackage[]>([]);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventRes, pkgsRes, statsRes] = await Promise.all([
        eventsApi.adminGetEvent(Number(eventId)),
        eventsApi.getPackages(String(eventId)), // In list detail we pass eventId slug to fetch pkgs
        eventsApi.adminGetEventStats(Number(eventId))
      ]);
      setEvent(eventRes);
      // Wait, eventsApi.getPackages expects event slug. In eventRes, we have the slug!
      // So let's fetch eventRes first, then packages using the slug!
      const finalPkgs = await eventsApi.getPackages(eventRes.slug);
      setEventPackages(finalPkgs);
      setEventStats(statsRes);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memuat detail event.');
      router.push('/admin/events');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDeletePackage = async (pkg: EventPackage) => {
    if (!event || !confirm(`Hapus paket "${pkg.name}"?`)) return;
    try {
      await eventsApi.adminDeletePackage(event.id, pkg.id);
      toast.success('Paket berhasil dihapus.');
      setEventPackages(prev => prev.filter(p => p.id !== pkg.id));
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus paket.');
    }
  };

  const handleDeleteEvent = async () => {
    if (!event || !confirm('Hapus event ini? Semua paket dan kode redeem akan ikut terhapus.')) return;
    try {
      await eventsApi.adminDeleteEvent(event.id);
      toast.success('Event dihapus.');
      router.push('/admin/events');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus event.');
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

  if (!event) return null;

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back navigation */}
        <button 
          onClick={() => router.push('/admin/events')}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#1D1D23] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke daftar event
        </button>

        {/* Event Header Dashboard */}
        <div className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[6px_6px_0px_#1D1D23] p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-3 border-[#1D1D23] pb-5 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${event.is_active ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                  {event.is_active ? 'EVENT AKTIF' : 'EVENT NONAKTIF'}
                </span>
                {event.event_date && (
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(event.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-black text-[#1D1D23] leading-tight">{event.name}</h1>
              <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                Penyelenggara: <span className="text-[#1D1D23]">{event.organizer_name}</span>
                {event.location && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {event.location}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                className="px-4 py-2.5 border-3 border-[#1D1D23] rounded-xl font-black text-xs uppercase bg-white text-[#1D1D23] hover:bg-slate-50 transition-colors shadow-[2px_2px_0px_#1D1D23] active:scale-95 flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Event
              </button>
              <button 
                onClick={handleDeleteEvent}
                className="px-4 py-2.5 border-3 border-red-500 rounded-xl font-black text-xs uppercase bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-[2px_2px_0px_rgba(239,68,68,0.2)] active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Event
              </button>
            </div>
          </div>

          {/* Description & frame default details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {event.description && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-600">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Deskripsi Event</p>
                <p className="leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
            
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-600 flex flex-col justify-center">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Frame Template Default</p>
              <p className="text-sm font-black text-[#1D1D23] mt-1">
                {(event as any).frame_template?.name || 'Tidak ada frame default'}
              </p>
              {event.expires_at && (
                <p className="text-[10px] text-red-500 font-bold mt-2">
                  Event kadaluarsa pada: {new Date(event.expires_at).toLocaleString('id-ID')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid Dashboard */}
        {eventStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Kode', value: eventStats.total_codes, bg: 'bg-slate-50', border: 'border-slate-200' },
              { label: 'Sudah Dibayar', value: eventStats.paid_codes, color: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
              { label: 'Sudah Foto', value: eventStats.used_codes, color: 'text-blue-600', bg: 'bg-blue-50/50', border: 'border-blue-200' },
              { label: 'Total Pendapatan', value: `Rp ${eventStats.revenue.toLocaleString('id-ID')}`, color: 'text-[#8A2BE2]', bg: 'bg-violet-50/50', border: 'border-violet-200' },
            ].map(s => (
              <div key={s.label} className={`border-3 rounded-2xl p-4 ${s.bg} ${s.border} shadow-[3px_3px_0px_#1D1D23]`}>
                <p className="text-[10px] font-black uppercase text-slate-400">{s.label}</p>
                <p className={`font-black text-base sm:text-lg mt-1 ${s.color || 'text-[#1D1D23]'}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Packages Section Card */}
        <div className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[6px_6px_0px_#1D1D23] p-6 mb-6">
          <div className="flex items-center justify-between border-b-3 border-[#1D1D23] pb-4 mb-4">
            <h2 className="font-black text-[#1D1D23] text-lg uppercase tracking-wider flex items-center gap-2">
              <Package className="w-5 h-5 text-[#8A2BE2]" /> Paket Tersedia ({eventPackages.length})
            </h2>
            <button 
              onClick={() => router.push(`/admin/events/${event.id}/packages/create`)} 
              className="flex items-center gap-1.5 text-xs font-black text-white bg-[#8A2BE2] border-3 border-[#1D1D23] rounded-xl px-4 py-2 hover:opacity-95 shadow-[2px_2px_0px_#1D1D23] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Paket
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {eventPackages.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl col-span-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Belum ada paket untuk event ini</p>
              </div>
            ) : (
              eventPackages.map(pkg => (
                <div key={pkg.id} className="flex items-center justify-between border-3 border-[#1D1D23] rounded-2xl p-4 bg-white hover:border-[#8A2BE2] hover:shadow-[3px_3px_0px_#8A2BE2] transition-all duration-200">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-[#1D1D23] text-sm">{pkg.name}</p>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${pkg.is_active ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-gray-50 border-gray-300 text-gray-400'}`}>
                        {pkg.is_active ? 'AKTIF' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-1">{pkg.photo_count} slot foto • Rp {pkg.price.toLocaleString('id-ID')}</p>
                    {pkg.description && <p className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[200px]">{pkg.description}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button 
                      onClick={() => router.push(`/admin/events/${event.id}/packages/${pkg.id}/edit`)} 
                      className="p-2 border-2 border-[#1D1D23] rounded-xl bg-white hover:bg-slate-50 transition-colors"
                      title="Edit Paket"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeletePackage(pkg)} 
                      className="p-2 border-2 border-red-200 rounded-xl bg-white hover:bg-red-50 transition-colors"
                      title="Hapus Paket"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Event Action Panel */}
        <div className="flex flex-col sm:flex-row gap-4">
          <a 
            href={`/admin/events/${event.id}/redeem-codes`} 
            className="flex-1 flex items-center justify-center gap-2 py-3.5 border-3 border-[#1D1D23] rounded-2xl font-black text-sm bg-[#1D1D23] text-white hover:opacity-90 transition-opacity shadow-[4px_4px_0px_rgba(0,0,0,0.15)] active:scale-95"
          >
            <QrCode className="w-5 h-5" /> Kelola Kode Redeem Event
          </a>
          <a 
            href={`/event/${event.slug}`} 
            target="_blank" 
            className="flex-1 flex items-center justify-center gap-2 py-3.5 border-3 border-[#1D1D23] rounded-2xl font-black text-sm bg-white text-[#1D1D23] hover:bg-slate-50 transition-colors shadow-[4px_4px_0px_rgba(0,0,0,0.15)] active:scale-95"
          >
            <Eye className="w-5 h-5" strokeWidth={2.5} /> Buka Halaman Publik Event
          </a>
        </div>
      </div>
    </div>
  );
}
