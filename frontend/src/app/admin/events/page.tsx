'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye, ChevronRight, Loader2, CheckCircle2, XCircle, Search, ToggleLeft, ToggleRight, Package, QrCode, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { eventsApi, frameTemplatesApi } from '@/lib/api';

type FrameTemplate = { id: number; name: string };
type EventPackage = { id: number; name: string; price: number; photo_count: number; is_active: boolean; description?: string; sort_order: number };
type Event = {
  id: number; name: string; slug: string; organizer_name: string;
  location?: string; event_date?: string; is_active: boolean;
  description?: string; expires_at?: string;
  frame_template_id?: number | null;
  packages_count: number; redeem_codes_count: number; photo_sessions_count: number;
};

type EventStats = {
  total_codes: number; paid_codes: number; used_codes: number;
  pending_codes: number; unused_paid_codes: number; revenue: number; completed_sessions: number;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);

  // Detail drawer state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventPackages, setEventPackages] = useState<EventPackage[]>([]);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Create/Edit Event Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState({ name: '', organizer_name: '', description: '', location: '', event_date: '', frame_template_id: '', expires_at: '', is_active: true });
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Create/Edit Package Modal
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<EventPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', description: '', price: '', photo_count: '4', is_active: true, sort_order: '0' });
  const [isSavingPkg, setIsSavingPkg] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await eventsApi.adminListEvents({ search: search || undefined });
      setEvents(res.data ?? res);
    } catch { toast.error('Gagal memuat daftar event.'); }
    finally { setIsLoading(false); }
  }, [search]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => {
    frameTemplatesApi.list().then((res: any) => setFrameTemplates(res.data ?? res)).catch(() => {});
  }, []);

  const openEventDetail = async (event: Event) => {
    setSelectedEvent(event);
    setIsLoadingDetail(true);
    try {
      const [pkgsRes, statsRes] = await Promise.all([
        eventsApi.getPackages(event.slug),
        eventsApi.adminGetEventStats(event.id),
      ]);
      setEventPackages(pkgsRes);
      setEventStats(statsRes);
    } catch { toast.error('Gagal memuat detail event.'); }
    finally { setIsLoadingDetail(false); }
  };

  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({ name: '', organizer_name: '', description: '', location: '', event_date: '', frame_template_id: '', expires_at: '', is_active: true });
    setShowEventModal(true);
  };

  const openEditEvent = (e: Event) => {
    setEditingEvent(e);
    setEventForm({
      name: e.name, organizer_name: e.organizer_name,
      description: e.description ?? '', location: e.location ?? '',
      event_date: e.event_date ?? '', frame_template_id: String(e.frame_template_id ?? ''),
      expires_at: e.expires_at ? e.expires_at.slice(0, 16) : '', is_active: e.is_active,
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name || !eventForm.organizer_name) return toast.error('Nama event dan penyelenggara wajib diisi.');
    setIsSavingEvent(true);
    try {
      const payload = {
        name: eventForm.name, organizer_name: eventForm.organizer_name,
        description: eventForm.description || undefined, location: eventForm.location || undefined,
        event_date: eventForm.event_date || undefined,
        frame_template_id: eventForm.frame_template_id ? Number(eventForm.frame_template_id) : null,
        expires_at: eventForm.expires_at || null, is_active: eventForm.is_active,
      };
      if (editingEvent) {
        await eventsApi.adminUpdateEvent(editingEvent.id, payload);
        toast.success('Event diperbarui!');
      } else {
        await eventsApi.adminCreateEvent(payload);
        toast.success('Event berhasil dibuat!');
      }
      setShowEventModal(false);
      fetchEvents();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingEvent(false); }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Hapus event ini? Semua paket dan kode redeem akan ikut terhapus.')) return;
    try {
      await eventsApi.adminDeleteEvent(id);
      toast.success('Event dihapus.');
      if (selectedEvent?.id === id) setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleActive = async (e: Event) => {
    try {
      await eventsApi.adminUpdateEvent(e.id, { is_active: !e.is_active });
      toast.success(e.is_active ? 'Event dinonaktifkan.' : 'Event diaktifkan.');
      fetchEvents();
      if (selectedEvent?.id === e.id) setSelectedEvent({ ...e, is_active: !e.is_active });
    } catch (err: any) { toast.error(err.message); }
  };

  const openCreatePackage = () => {
    setEditingPackage(null);
    setPkgForm({ name: '', description: '', price: '', photo_count: '4', is_active: true, sort_order: '0' });
    setShowPackageModal(true);
  };

  const openEditPackage = (pkg: EventPackage) => {
    setEditingPackage(pkg);
    setPkgForm({ name: pkg.name, description: pkg.description ?? '', price: String(pkg.price), photo_count: String(pkg.photo_count), is_active: pkg.is_active, sort_order: String(pkg.sort_order) });
    setShowPackageModal(true);
  };

  const handleSavePackage = async () => {
    if (!selectedEvent) return;
    if (!pkgForm.name || !pkgForm.price || !pkgForm.photo_count) return toast.error('Isi semua field wajib.');
    setIsSavingPkg(true);
    try {
      const payload = { name: pkgForm.name, description: pkgForm.description || undefined, price: Number(pkgForm.price), photo_count: Number(pkgForm.photo_count), is_active: pkgForm.is_active, sort_order: Number(pkgForm.sort_order) };
      if (editingPackage) {
        await eventsApi.adminUpdatePackage(selectedEvent.id, editingPackage.id, payload);
        toast.success('Paket diperbarui!');
      } else {
        await eventsApi.adminCreatePackage(selectedEvent.id, payload);
        toast.success('Paket ditambahkan!');
      }
      setShowPackageModal(false);
      const pkgsRes = await eventsApi.getPackages(selectedEvent.slug);
      setEventPackages(pkgsRes);
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSavingPkg(false); }
  };

  const handleDeletePackage = async (pkg: EventPackage) => {
    if (!selectedEvent || !confirm(`Hapus paket "${pkg.name}"?`)) return;
    try {
      await eventsApi.adminDeletePackage(selectedEvent.id, pkg.id);
      toast.success('Paket dihapus.');
      setEventPackages(prev => prev.filter(p => p.id !== pkg.id));
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#1D1D23]">Manajemen Event</h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Kelola event, paket, dan kode redeem peserta</p>
          </div>
          <button onClick={openCreateEvent} className="neobrutal-button px-5 py-2.5 bg-[#8A2BE2] text-white text-sm font-black flex items-center gap-2">
            <Plus className="w-4 h-4" /> Buat Event
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Event List */}
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari event..." className="w-full pl-9 pr-4 py-2.5 border-3 border-[#1D1D23] rounded-xl text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" /></div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-bold">Belum ada event. Buat event pertama kamu!</div>
            ) : (
              <div className="flex flex-col gap-3">
                {events.map(event => (
                  <div key={event.id} className={`bg-white border-3 rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23] cursor-pointer transition-all hover:shadow-[4px_4px_0px_#8A2BE2] ${selectedEvent?.id === event.id ? 'border-[#8A2BE2]' : 'border-[#1D1D23]'}`} onClick={() => openEventDetail(event)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${event.is_active ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                            {event.is_active ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                          {event.event_date && <span className="text-[10px] text-gray-400 font-medium">{new Date(event.event_date).toLocaleDateString('id-ID')}</span>}
                        </div>
                        <h3 className="font-black text-[#1D1D23] text-base leading-tight truncate">{event.name}</h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">{event.organizer_name}{event.location ? ` • ${event.location}` : ''}</p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-500 font-bold">
                          <span className="flex items-center gap-1"><Package className="w-3 h-3" />{event.packages_count} paket</span>
                          <span className="flex items-center gap-1"><QrCode className="w-3 h-3" />{event.redeem_codes_count} kode</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); openEditEvent(event); }} className="p-1.5 border-2 border-[#1D1D23] rounded-lg bg-white hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={e => { e.stopPropagation(); handleToggleActive(event); }} className="p-1.5 border-2 border-[#1D1D23] rounded-lg bg-white hover:bg-slate-50">
                          {event.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteEvent(event.id); }} className="p-1.5 border-2 border-red-200 rounded-lg bg-white hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Detail Panel */}
          {selectedEvent && (
            <div className="bg-white border-3 border-[#1D1D23] rounded-2xl shadow-[5px_5px_0px_#1D1D23] p-5 h-fit sticky top-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-black text-[#1D1D23] text-lg leading-tight">{selectedEvent.name}</h2>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{selectedEvent.organizer_name}</p>
                </div>
                <a href={`/event/${selectedEvent.slug}`} target="_blank" className="p-2 border-2 border-[#1D1D23] rounded-lg hover:bg-slate-50" title="Buka halaman publik">
                  <Eye className="w-4 h-4" />
                </a>
              </div>

              {isLoadingDetail ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#8A2BE2]" /></div>
              ) : (
                <>
                  {/* Stats */}
                  {eventStats && (
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {[
                        { label: 'Total Kode', value: eventStats.total_codes },
                        { label: 'Sudah Dibayar', value: eventStats.paid_codes, color: 'text-emerald-600' },
                        { label: 'Sudah Foto', value: eventStats.used_codes, color: 'text-blue-600' },
                        { label: 'Revenue', value: `Rp ${eventStats.revenue.toLocaleString('id-ID')}`, color: 'text-[#8A2BE2]' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                          <p className="text-[10px] font-black uppercase text-gray-400">{s.label}</p>
                          <p className={`font-black text-lg ${s.color || 'text-[#1D1D23]'}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Packages */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-[#1D1D23] text-sm uppercase tracking-wide">Paket</h3>
                    <button onClick={openCreatePackage} className="flex items-center gap-1 text-xs font-black text-[#8A2BE2] border-2 border-[#8A2BE2] rounded-lg px-2 py-1 hover:bg-purple-50">
                      <Plus className="w-3 h-3" /> Tambah
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 mb-4">
                    {eventPackages.length === 0 && <p className="text-xs text-gray-400 font-medium text-center py-3">Belum ada paket. Tambah paket untuk event ini.</p>}
                    {eventPackages.map(pkg => (
                      <div key={pkg.id} className="flex items-center justify-between border-2 border-gray-200 rounded-xl p-3">
                        <div>
                          <p className="font-black text-[#1D1D23] text-sm">{pkg.name}</p>
                          <p className="text-xs text-gray-500 font-medium">{pkg.photo_count} foto • Rp {pkg.price.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPackage(pkg)} className="p-1.5 border-2 border-[#1D1D23] rounded-lg hover:bg-slate-50"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeletePackage(pkg)} className="p-1.5 border-2 border-red-200 rounded-lg hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-3 border-t-2 border-gray-100">
                    <a href={`/admin/events/${selectedEvent.id}/redeem-codes`} className="flex items-center justify-center gap-2 w-full py-2.5 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#1D1D23] text-white hover:opacity-90 transition-opacity">
                      <QrCode className="w-4 h-4" /> Lihat Kode Redeem
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[8px_8px_0px_#1D1D23] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="font-black text-[#1D1D23] text-xl mb-5">{editingEvent ? 'Edit Event' : 'Buat Event Baru'}</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Nama Event *', key: 'name', placeholder: 'Foto Wisuda SMA 1 Jakarta 2025' },
                { label: 'Penyelenggara *', key: 'organizer_name', placeholder: 'SMA Negeri 1 Jakarta' },
                { label: 'Lokasi', key: 'location', placeholder: 'Aula Sekolah' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">{f.label}</label>
                  <input type="text" value={(eventForm as any)[f.key]} onChange={e => setEventForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
                </div>
              ))}
              <div>
                <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Deskripsi</label>
                <textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Tanggal Event</label>
                  <input type="date" value={eventForm.event_date} onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))} className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Kadaluarsa</label>
                  <input type="datetime-local" value={eventForm.expires_at} onChange={e => setEventForm(p => ({ ...p, expires_at: e.target.value }))} className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Frame Default Event</label>
                <select value={eventForm.frame_template_id} onChange={e => setEventForm(p => ({ ...p, frame_template_id: e.target.value }))} className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]">
                  <option value="">Pilih frame (opsional)</option>
                  {frameTemplates.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={eventForm.is_active} onChange={e => setEventForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-[#8A2BE2]" />
                <span className="text-sm font-bold text-[#1D1D23]">Event aktif (bisa dibeli peserta)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEventModal(false)} className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm hover:bg-gray-50">Batal</button>
              <button onClick={handleSaveEvent} disabled={isSavingEvent} className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] disabled:opacity-60 flex items-center justify-center gap-2">
                {isSavingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white border-4 border-[#1D1D23] rounded-3xl shadow-[8px_8px_0px_#1D1D23] p-6 max-w-md w-full">
            <h2 className="font-black text-[#1D1D23] text-xl mb-5">{editingPackage ? 'Edit Paket' : 'Tambah Paket Baru'}</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Nama Paket *</label>
                <input type="text" value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="Paket Silver" className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Deskripsi</label>
                <input type="text" value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi singkat paket" className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Harga (Rp) *</label>
                  <input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} placeholder="25000" min="0" className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-[#1D1D23] mb-1 block">Jumlah Foto *</label>
                  <input type="number" value={pkgForm.photo_count} onChange={e => setPkgForm(p => ({ ...p, photo_count: e.target.value }))} placeholder="4" min="1" max="20" className="w-full border-2 border-[#1D1D23] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-[#8A2BE2]" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={pkgForm.is_active} onChange={e => setPkgForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-[#8A2BE2]" />
                <span className="text-sm font-bold text-[#1D1D23]">Paket aktif (bisa dipilih peserta)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPackageModal(false)} className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm hover:bg-gray-50">Batal</button>
              <button onClick={handleSavePackage} disabled={isSavingPkg} className="flex-1 py-3 border-3 border-[#1D1D23] rounded-xl font-black text-sm bg-[#8A2BE2] text-white shadow-[3px_3px_0px_#1D1D23] disabled:opacity-60 flex items-center justify-center gap-2">
                {isSavingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
