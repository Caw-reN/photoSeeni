'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  RotateCw,
  MoveHorizontal,
  MoveVertical,
  MousePointerClick,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type SlotCoordinate = {
  id?: string | number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x_percent?: number;
  y_percent?: number;
  width_percent?: number;
  height_percent?: number;
  order?: number;
};

type Frame = {
  id: number;
  name: string;
  image_path: string;
  image_url: string;
  slots?: SlotCoordinate[];
  coordinates?: string | SlotCoordinate[];
};

type CapturedPhoto = {
  slot: number;
  url: string;
};

type SlotData = {
  photoUrl: string;
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
};

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');
  return 'https://e942-103-224-73-153.ngrok-free.app';
})();

// Route semua gambar frame melalui proxy agar header ngrok bypass dikirim dari server
const proxyImageUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  return `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
};

const getFrameImageUrl = (frame: Frame | null): string => {
  if (!frame) return '';
  if (frame.id) return proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${frame.id}/image`);
  const url = frame.image_url || frame.image_path;
  if (!url) return '';
  const abs = url.startsWith('http') ? url : `${BACKEND_URL}/${url}`;
  return proxyImageUrl(abs);
};

const getParsedCoordinates = (frame: Frame | null): SlotCoordinate[] => {
  if (!frame) return [];
  if (frame.coordinates) {
    try {
      const parsed = typeof frame.coordinates === 'string' ? JSON.parse(frame.coordinates) : frame.coordinates;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse coordinates:', e);
    }
  }
  if (frame.slots && Array.isArray(frame.slots)) return frame.slots;
  return [];
};

export default function EditPhotoPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [coordinates, setCoordinates] = useState<SlotCoordinate[]>([]);
  const [slotsData, setSlotsData] = useState<SlotData[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track orientation per slot: 'landscape' = fit height, 'portrait' = fit width
  const [slotOrientations, setSlotOrientations] = useState<Record<number, 'landscape' | 'portrait'>>({});

  // Untuk mengukur ukuran gambar frame yang ter-render agar slot overlay presisi
  const frameImgRef = useRef<HTMLImageElement>(null);
  const [frameImgSize, setFrameImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const storedPhotos = localStorage.getItem('captured_photos');
      const storedFrame = localStorage.getItem('selected_frame');
      if (!storedPhotos || !storedFrame) {
        toast.error('Data sesi tidak ditemukan, kembali ke pemilihan frame.');
        router.push('/select-frame');
        return;
      }
      const photos: CapturedPhoto[] = JSON.parse(storedPhotos);
      const frame: Frame = JSON.parse(storedFrame);
      const coords = getParsedCoordinates(frame);
      setCapturedPhotos(photos);
      setSelectedFrame(frame);
      setCoordinates(coords);
      const initialSlotsData: SlotData[] = coords.map((_, index) => ({
        photoUrl: photos[index] ? photos[index].url : '',
        scale: 1,
        rotate: 0,
        translateX: 0,
        translateY: 0,
      }));
      setSlotsData(initialSlotsData);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan memuat data.');
      router.push('/select-frame');
    }
  }, [isMounted, router]);

  // Update ukuran frame image saat render/resize
  useEffect(() => {
    const update = () => {
      if (frameImgRef.current) {
        setFrameImgSize({
          w: frameImgRef.current.offsetWidth,
          h: frameImgRef.current.offsetHeight,
        });
      }
    };
    const img = frameImgRef.current;
    if (img) {
      img.addEventListener('load', update);
      update();
    }
    window.addEventListener('resize', update);
    return () => {
      img?.removeEventListener('load', update);
      window.removeEventListener('resize', update);
    };
  }, [isLoading]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, photoUrl: string) => {
    e.dataTransfer.setData('text/plain', photoUrl);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault();
    const photoUrl = e.dataTransfer.getData('text/plain');
    if (photoUrl) {
      setSlotsData(prev => {
        const newData = [...prev];
        newData[slotIndex] = { ...newData[slotIndex], photoUrl };
        return newData;
      });
      setActiveSlotIndex(slotIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  const handleControlChange = (field: keyof SlotData, value: number) => {
    if (activeSlotIndex === null) return;
    setSlotsData(prev => {
      const newData = [...prev];
      newData[activeSlotIndex] = { ...newData[activeSlotIndex], [field]: value };
      return newData;
    });
  };

  const handleProceed = () => {
    localStorage.setItem('arranged_slots', JSON.stringify(slotsData));
    router.push('/checkout');
  };

  // Tap foto di strip → masukkan ke slot aktif atau slot kosong berikutnya
  const handlePhotoTap = (photoUrl: string) => {
    if (activeSlotIndex !== null) {
      setSlotsData(prev => {
        const n = [...prev];
        n[activeSlotIndex] = { ...n[activeSlotIndex], photoUrl };
        return n;
      });
    } else {
      const emptyIdx = slotsData.findIndex(s => !s.photoUrl);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
      setSlotsData(prev => {
        const n = [...prev];
        n[targetIdx] = { ...n[targetIdx], photoUrl };
        return n;
      });
      setActiveSlotIndex(targetIdx);
    }
  };

  if (!isMounted || isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1D1D23]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8A2BE2] border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-bold text-lg">Memuat halaman...</p>
        </div>
      </div>
    );
  }

  const activeData = activeSlotIndex !== null ? slotsData[activeSlotIndex] : null;

  return (
    <div className="w-screen bg-[#1D1D23] flex flex-col md:flex-row overflow-hidden" style={{ height: '100dvh' }}>

      {/* ═══ Tombol Kembali (Fixed) ═══ */}
      <button
        onClick={() => router.push('/select-frame')}
        className="fixed top-4 left-4 z-[60] w-11 h-11 flex items-center justify-center rounded-full bg-white border-3 border-[#1D1D23] shadow-[3px_3px_0px_#1D1D23] hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
        title="Kembali ke Pilih Frame"
      >
        <ArrowLeft className="w-5 h-5 text-[#1D1D23]" strokeWidth={3} />
      </button>

      {/* ══════════════════════════════════════════════════
           DESKTOP LAYOUT (md and above)
           Left: foto list | Center: canvas | Right: controls
          ══════════════════════════════════════════════════ */}

      {/* ─── DESKTOP KIRI: Daftar Foto ─── */}
      <div className="hidden md:flex md:w-[20%] md:min-w-[200px] md:max-w-[280px] bg-[#FFFDF7] border-r-4 border-slate-900 flex-col h-full z-30">
        <div className="p-4 pt-18 border-b-4 border-slate-900 shrink-0 bg-indigo-500">
          <h2 className="text-xl font-black text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">Foto Kamu</h2>
          <p className="text-indigo-100 text-xs font-bold mt-1">Seret ke slot atau klik untuk isi</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {capturedPhotos.map((photo, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, photo.url)}
              onClick={() => handlePhotoTap(photo.url)}
              className="relative aspect-[3/4] bg-slate-200 border-4 border-slate-900 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] transition-all"
            >
              <img src={photo.url} alt={`Foto ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
              <div className="absolute bottom-0 right-0 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-tl-lg">
                FOTO {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── DESKTOP TENGAH: Canvas ─── */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-between p-6 bg-slate-100 relative h-full" style={{ paddingBottom: '4rem' }}>
        <div className="shrink-0 mb-4 text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-1 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">Penempatan Foto</h1>
          <p className="text-slate-600 font-extrabold text-sm border-b-2 border-slate-400 inline-block pb-1">Sesuaikan posisi, ukuran, dan rotasi foto</p>
        </div>
        <div className="flex-1 w-full flex items-center justify-center overflow-hidden" onClick={() => setActiveSlotIndex(null)}>
          <div className="relative inline-block shadow-[8px_8px_0px_0px_rgba(30,41,59,1)] border-4 border-slate-900 rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {coordinates.map((slot, index) => {
              const isActive = activeSlotIndex === index;
              const data = slotsData[index];
              return (
                <div
                  key={index}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragOver={handleDragOver}
                  onClick={() => setActiveSlotIndex(index)}
                  style={{
                    position: 'absolute',
                    left: `${slot.x_percent ?? slot.x ?? 0}%`,
                    top: `${slot.y_percent ?? slot.y ?? 0}%`,
                    width: `${slot.width_percent ?? slot.width ?? 0}%`,
                    height: `${slot.height_percent ?? slot.height ?? 0}%`,
                  }}
                  className={`overflow-hidden flex items-center justify-center relative bg-slate-200 transition-all cursor-pointer ${isActive ? 'ring-4 ring-indigo-500 ring-offset-2 z-20 shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'z-0 hover:ring-2 hover:ring-indigo-300'}`}
                >
                  {data?.photoUrl ? (
                    <img
                      src={data.photoUrl}
                      alt={`Slot ${index + 1}`}
                      className="absolute max-w-none pointer-events-none"
                      style={{
                        top: '50%',
                        left: '50%',
                        ...(slotOrientations[index] === 'landscape'
                          ? { height: '100%', width: 'auto' }
                          : { width: '100%', height: 'auto' }),
                        transform: `translate(calc(-50% + ${data.translateX}px), calc(-50% + ${data.translateY}px)) scale(${data.scale}) rotate(${data.rotate}deg)`,
                        transformOrigin: 'center center',
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const ori = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
                        setSlotOrientations(prev => ({ ...prev, [index]: ori }));
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center opacity-30 pointer-events-none">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-xs font-black">SLOT {slot.order ?? index + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
            <img
              src={getFrameImageUrl(selectedFrame)}
              alt="Frame Overlay"
              className="max-h-[65vh] md:max-h-[70vh] w-auto block relative z-10 pointer-events-none rounded-lg"
            />
          </div>
        </div>
        <div className="shrink-0 mt-6 z-20">
          <button onClick={handleProceed} className="px-10 py-4 rounded-2xl font-extrabold text-xl border-4 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(30,41,59,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] transition-all flex items-center justify-center gap-3 cursor-pointer">
            LANJUTKAN <ArrowRight className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* ─── DESKTOP KANAN: Controls ─── */}
      <div className={`hidden md:flex md:w-[350px] bg-[#FFFDF7] border-l-4 border-slate-900 flex-col h-full z-20 transition-transform duration-300 ${activeSlotIndex !== null ? 'translate-x-0' : 'translate-x-full absolute right-0'}`}>
        {activeSlotIndex !== null && activeData ? (
          <>
            <div className="p-6 border-b-4 border-slate-900 shrink-0 bg-amber-400">
              <h2 className="text-2xl font-black text-slate-900 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">Edit Slot {activeSlotIndex + 1}</h2>
              <p className="text-slate-900 text-sm font-extrabold">Atur posisi dan ukuran foto di slot ini.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <ControlCard icon={<ZoomIn className="w-5 h-5 text-indigo-600" strokeWidth={3} />} label="Zoom" value={`${activeData.scale.toFixed(1)}x`} valueClass="bg-indigo-100 text-indigo-800">
                <input type="range" min="0.5" max="3" step="0.1" value={activeData.scale} onChange={(e) => handleControlChange('scale', parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer h-3 bg-slate-200 rounded-full border-2 border-slate-900" />
              </ControlCard>
              <ControlCard icon={<RotateCw className="w-5 h-5 text-emerald-600" strokeWidth={3} />} label="Putar" value={`${activeData.rotate}°`} valueClass="bg-emerald-100 text-emerald-800">
                <input type="range" min="-180" max="180" step="1" value={activeData.rotate} onChange={(e) => handleControlChange('rotate', parseInt(e.target.value))} className="w-full accent-emerald-600 cursor-pointer h-3 bg-slate-200 rounded-full border-2 border-slate-900" />
                <div className="flex justify-center mt-3">
                  <button onClick={() => handleControlChange('rotate', 0)} className="text-xs font-black bg-emerald-400 text-slate-900 hover:bg-emerald-300 px-4 py-2 rounded-lg border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">Reset Rotasi</button>
                </div>
              </ControlCard>
              <ControlCard icon={<MoveHorizontal className="w-5 h-5 text-rose-600" strokeWidth={3} />} label="Geser Kanan/Kiri" value={`${activeData.translateX}px`} valueClass="bg-rose-100 text-rose-800">
                <input type="range" min="-500" max="500" step="5" value={activeData.translateX} onChange={(e) => handleControlChange('translateX', parseInt(e.target.value))} className="w-full accent-rose-600 cursor-pointer h-3 bg-slate-200 rounded-full border-2 border-slate-900" />
              </ControlCard>
              <ControlCard icon={<MoveVertical className="w-5 h-5 text-sky-600" strokeWidth={3} />} label="Geser Atas/Bawah" value={`${activeData.translateY}px`} valueClass="bg-sky-100 text-sky-800">
                <input type="range" min="-500" max="500" step="5" value={activeData.translateY} onChange={(e) => handleControlChange('translateY', parseInt(e.target.value))} className="w-full accent-sky-600 cursor-pointer h-3 bg-slate-200 rounded-full border-2 border-slate-900" />
              </ControlCard>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-50">
            <MousePointerClick className="w-16 h-16 text-slate-400 mb-4" />
            <h3 className="text-xl font-black text-slate-600 mb-2">Pilih Slot Foto</h3>
            <p className="font-bold text-slate-500">Klik salah satu foto di area tengah untuk mulai mengedit.</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
           MOBILE LAYOUT (below md)
           1. Full Preview (atas, flex-shrink-0)
           2. Horizontal photo strip (scroll samping, z-20)
           3. Controls panel (bawah, z-30)
          ══════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col w-full" style={{ height: '100dvh' }}>

        {/* ── 1. PREVIEW AREA (atas, mengisi sisa ruang) ── */}
        <div className="relative flex-1 flex items-center justify-center bg-[#1D1D23] overflow-hidden min-h-0">
          {/* Header kecil */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-14 pb-2 bg-gradient-to-b from-black/60 to-transparent">
            <span className="text-white font-black text-sm tracking-wide">Penempatan Foto</span>
            {activeSlotIndex !== null && (
              <span className="bg-amber-400 text-slate-900 font-black text-xs px-3 py-1 rounded-full border-2 border-slate-900">
                SLOT {activeSlotIndex + 1} AKTIF
              </span>
            )}
          </div>

          {/* Frame + Slots Container */}
          <div
            className="relative inline-block rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-slate-800"
            onClick={() => setActiveSlotIndex(null)}
          >
            {/* Photo slots — z di bawah frame */}
            {coordinates.map((slot, index) => {
              const isActive = activeSlotIndex === index;
              const data = slotsData[index];
              return (
                <div
                  key={index}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragOver={handleDragOver}
                  onClick={(e) => { e.stopPropagation(); setActiveSlotIndex(index === activeSlotIndex ? null : index); }}
                  style={{
                    position: 'absolute',
                    left: `${slot.x_percent ?? slot.x ?? 0}%`,
                    top: `${slot.y_percent ?? slot.y ?? 0}%`,
                    width: `${slot.width_percent ?? slot.width ?? 0}%`,
                    height: `${slot.height_percent ?? slot.height ?? 0}%`,
                    zIndex: isActive ? 15 : 5,
                  }}
                  className={`overflow-hidden flex items-center justify-center bg-slate-300 cursor-pointer transition-all ${isActive ? 'ring-4 ring-amber-400 ring-offset-1' : ''}`}
                >
                  {data?.photoUrl ? (
                    <img
                      src={data.photoUrl}
                      alt={`Slot ${index + 1}`}
                      className="absolute max-w-none pointer-events-none"
                      style={{
                        top: '50%',
                        left: '50%',
                        ...(slotOrientations[index] === 'landscape'
                          ? { height: '100%', width: 'auto' }
                          : { width: '100%', height: 'auto' }),
                        transform: `translate(calc(-50% + ${data.translateX}px), calc(-50% + ${data.translateY}px)) scale(${data.scale}) rotate(${data.rotate}deg)`,
                        transformOrigin: 'center center',
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const ori = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
                        setSlotOrientations(prev => ({ ...prev, [index]: ori }));
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                      <span className="text-[9px] font-black text-slate-600">SLOT {slot.order ?? index + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Frame image — z di atas slot, pointer-events-none */}
            <img
              ref={frameImgRef}
              src={getFrameImageUrl(selectedFrame)}
              alt="Frame Overlay"
              className="block relative pointer-events-none rounded-xl"
              style={{ zIndex: 20, maxHeight: '50dvh', width: 'auto' }}
              onLoad={() => {
                if (frameImgRef.current) {
                  setFrameImgSize({ w: frameImgRef.current.offsetWidth, h: frameImgRef.current.offsetHeight });
                }
              }}
            />
          </div>
        </div>

        {/* ── 2. HORIZONTAL PHOTO STRIP (scroll samping) ── */}
        <div className="shrink-0 bg-[#111118] border-t-2 border-slate-700 z-20 relative">
          <div className="px-3 pt-2 pb-1 flex items-center gap-2">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Foto Kamu</span>
            {activeSlotIndex !== null && (
              <span className="text-amber-400 text-[10px] font-black">— ketuk foto untuk isi Slot {activeSlotIndex + 1}</span>
            )}
          </div>
          <div className="flex gap-3 px-3 pb-3 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none' }}>
            {capturedPhotos.map((photo, index) => {
              // Cek apakah foto ini sudah dipakai di slot mana
              const usedInSlot = slotsData.findIndex(s => s.photoUrl === photo.url);
              return (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, photo.url)}
                  onClick={() => handlePhotoTap(photo.url)}
                  className="relative shrink-0 w-[70px] h-[90px] bg-slate-700 border-3 border-slate-600 rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-all hover:border-amber-400"
                  style={{ borderWidth: usedInSlot !== -1 ? 3 : 2, borderColor: usedInSlot !== -1 ? '#f59e0b' : '' }}
                >
                  <img src={photo.url} alt={`Foto ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
                  {/* Badge nomor foto */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-2 pb-0.5 text-center">
                    <span className="text-white text-[9px] font-black">{index + 1}</span>
                  </div>
                  {/* Checkmark jika sudah dipakai */}
                  {usedInSlot !== -1 && (
                    <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5 border border-slate-900">
                      <CheckCircle className="w-2.5 h-2.5 text-slate-900" strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. CONTROLS PANEL (bawah) ── */}
        <div className="shrink-0 bg-[#FFFDF7] border-t-4 border-slate-900 z-30" style={{ maxHeight: '35dvh', overflowY: 'auto' }}>
          {activeSlotIndex !== null && activeData ? (
            <div className="p-4 flex flex-col gap-3">
              {/* Header kontrol */}
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 text-base">Edit Slot {activeSlotIndex + 1}</span>
                <button
                  onClick={() => setActiveSlotIndex(null)}
                  className="text-xs font-bold text-slate-500 border-2 border-slate-300 rounded-lg px-2 py-1 hover:bg-slate-100"
                >
                  Tutup
                </button>
              </div>

              {/* Zoom */}
              <MobileControl
                icon={<ZoomIn className="w-4 h-4 text-indigo-600" strokeWidth={3} />}
                label="Zoom"
                value={`${activeData.scale.toFixed(1)}x`}
                valueClass="text-indigo-600"
              >
                <input type="range" min="0.5" max="3" step="0.1" value={activeData.scale}
                  onChange={(e) => handleControlChange('scale', parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-2 cursor-pointer" />
              </MobileControl>

              {/* Putar */}
              <MobileControl
                icon={<RotateCw className="w-4 h-4 text-emerald-600" strokeWidth={3} />}
                label="Putar"
                value={`${activeData.rotate}°`}
                valueClass="text-emerald-600"
              >
                <div className="flex gap-2 items-center">
                  <input type="range" min="-180" max="180" step="1" value={activeData.rotate}
                    onChange={(e) => handleControlChange('rotate', parseInt(e.target.value))}
                    className="flex-1 accent-emerald-600 h-2 cursor-pointer" />
                  <button onClick={() => handleControlChange('rotate', 0)} className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-400 shrink-0">Reset</button>
                </div>
              </MobileControl>

              {/* Geser X */}
              <MobileControl
                icon={<MoveHorizontal className="w-4 h-4 text-rose-600" strokeWidth={3} />}
                label="Geser ← →"
                value={`${activeData.translateX}px`}
                valueClass="text-rose-600"
              >
                <input type="range" min="-500" max="500" step="5" value={activeData.translateX}
                  onChange={(e) => handleControlChange('translateX', parseInt(e.target.value))}
                  className="w-full accent-rose-600 h-2 cursor-pointer" />
              </MobileControl>

              {/* Geser Y */}
              <MobileControl
                icon={<MoveVertical className="w-4 h-4 text-sky-600" strokeWidth={3} />}
                label="Geser ↑ ↓"
                value={`${activeData.translateY}px`}
                valueClass="text-sky-600"
              >
                <input type="range" min="-500" max="500" step="5" value={activeData.translateY}
                  onChange={(e) => handleControlChange('translateY', parseInt(e.target.value))}
                  className="w-full accent-sky-600 h-2 cursor-pointer" />
              </MobileControl>
            </div>
          ) : (
            <div className="p-4 flex items-center gap-3 text-slate-500">
              <MousePointerClick className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold">Ketuk slot foto di preview atas untuk mengatur posisi foto.</p>
            </div>
          )}

          {/* Tombol Lanjutkan */}
          <div className="px-4 pb-4 pt-2 border-t-2 border-slate-200">
            <button
              onClick={handleProceed}
              className="w-full py-3.5 rounded-2xl font-extrabold text-base border-4 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] active:translate-y-1 active:shadow-[1px_1px_0px_0px_rgba(30,41,59,1)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              LANJUTKAN KE CHECKOUT <ArrowRight className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function ControlCard({ icon, label, value, valueClass, children }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border-4 border-slate-900 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]">
      <div className="flex justify-between items-center mb-3">
        <label className="font-black text-slate-900 flex items-center gap-2">{icon} {label}</label>
        <span className={`font-bold text-sm px-2 py-1 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${valueClass}`}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function MobileControl({ icon, label, value, valueClass, children }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">{icon}{label}</span>
        <span className={`font-bold text-xs ${valueClass}`}>{value}</span>
      </div>
      {children}
    </div>
  );
}
