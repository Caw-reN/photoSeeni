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
  ChevronLeft,
  ChevronRight,
  Type,
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
  type?: 'photo' | 'text';
  fontFamily?: string;
  color?: string;
  fontSize?: number;
  maxChars?: number;
};

type Frame = {
  id: number;
  name: string;
  image_path: string;
  image_url: string;
  is_bw?: boolean;
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
  textValue?: string;
};

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.startsWith('/')) return apiUrl.replace(/\/api\/?$/, '');
  return '';
})();

// Route semua gambar frame melalui proxy agar header ngrok bypass dikirim dari server
const proxyImageUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/')) return targetUrl; // relative — Next.js rewrite handles it
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
  const [slotsDataList, setSlotsDataList] = useState<SlotData[][]>([]);
  const [activePrintIndex, setActivePrintIndex] = useState(0);
  const [printCount, setPrintCount] = useState(1);
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
      const storedEventSession = localStorage.getItem('event_session_info');
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

      // Determine print count from event session or default 1
      let pCount = 1;
      if (storedEventSession) {
        try {
          const ev = JSON.parse(storedEventSession);
          if (ev?.printCount) pCount = ev.printCount;
        } catch (_) {}
      }
      setPrintCount(pCount);

      // Always build fresh slots from coordinates and photos (never restore stale cache)
      // This ensures text slots are always properly identified from the frame definition
      let photoIdx = 0;
      const fresh: SlotData[] = coords.map((c) => {
        if (c.type === 'text') {
          return {
            photoUrl: '',
            scale: 1,
            rotate: 0,
            translateX: 0,
            translateY: 0,
            textValue: '',
          };
        }
        const pUrl = photos[photoIdx] ? photos[photoIdx].url : '';
        photoIdx++;
        return {
          photoUrl: pUrl,
          scale: 1,
          rotate: 0,
          translateX: 0,
          translateY: 0,
        };
      });
      const initialList = Array.from({ length: pCount }, () => fresh.map(s => ({ ...s })));
      setSlotsDataList(initialList);
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
    if (photoUrl && coordinates[slotIndex]?.type !== 'text') {
      setSlotsDataList(prev => {
        const newList = prev.map(arr => [...arr]);
        newList[activePrintIndex] = [...(newList[activePrintIndex] || [])];
        newList[activePrintIndex][slotIndex] = { ...newList[activePrintIndex][slotIndex], photoUrl };
        return newList;
      });
      setActiveSlotIndex(slotIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  const handleControlChange = (field: keyof SlotData, value: number) => {
    if (activeSlotIndex === null) return;
    setSlotsDataList(prev => {
      const newList = prev.map(arr => [...arr]);
      newList[activePrintIndex] = [...(newList[activePrintIndex] || [])];
      newList[activePrintIndex][activeSlotIndex] = { ...newList[activePrintIndex][activeSlotIndex], [field]: value };
      return newList;
    });
  };

  const handleTextChange = (slotIndex: number, value: string) => {
    const slot = coordinates[slotIndex];
    const maxChars = slot?.maxChars || 200;
    if (value.length > maxChars) return;
    setSlotsDataList(prev => {
      const newList = prev.map(arr => [...arr]);
      newList[activePrintIndex] = [...(newList[activePrintIndex] || [])];
      newList[activePrintIndex][slotIndex] = { ...newList[activePrintIndex][slotIndex], textValue: value };
      return newList;
    });
  };

  const handleProceed = () => {
    // Auto-fill empty prints with Cetakan 1's data
    const finalSlotsDataList = slotsDataList.map((slots, i) => {
      if (i > 0 && slots.every(s => !s.photoUrl && !s.textValue)) {
        return [...slotsDataList[0]];
      }
      return slots;
    });

    localStorage.setItem('arranged_slots_list', JSON.stringify(finalSlotsDataList));
    localStorage.setItem('arranged_slots', JSON.stringify(finalSlotsDataList[0] || []));
    router.push('/checkout');
  };

  // Tap foto di strip → masukkan ke slot aktif atau slot kosong berikutnya
  const handlePhotoTap = (photoUrl: string) => {
    // If we have an active slot and it is a photo slot (not text), replace it.
    if (activeSlotIndex !== null && coordinates[activeSlotIndex]?.type !== 'text') {
      setSlotsDataList(prev => {
        const newList = prev.map(arr => [...arr]);
        newList[activePrintIndex] = [...(newList[activePrintIndex] || [])];
        newList[activePrintIndex][activeSlotIndex] = { ...newList[activePrintIndex][activeSlotIndex], photoUrl };
        return newList;
      });
    } else {
      // Find the first empty photo slot
      const slotsData = slotsDataList[activePrintIndex] || [];
      const emptyIdx = slotsData.findIndex((s, i) => coordinates[i]?.type !== 'text' && !s.photoUrl);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
      
      // If the target slot is indeed a photo slot, update it
      if (coordinates[targetIdx]?.type !== 'text') {
        setSlotsDataList(prev => {
          const newList = prev.map(arr => [...arr]);
          newList[activePrintIndex] = [...(newList[activePrintIndex] || [])];
          newList[activePrintIndex][targetIdx] = { ...newList[activePrintIndex][targetIdx], photoUrl };
          return newList;
        });
        setActiveSlotIndex(targetIdx);
      }
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

  const slotsData = slotsDataList[activePrintIndex] || [];
  const activeData = activeSlotIndex !== null ? slotsData[activeSlotIndex] : null;
  const activeCoord = activeSlotIndex !== null ? coordinates[activeSlotIndex] : null;
  const isActiveText = activeCoord?.type === 'text';

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

      {/* ──────────────────────────────────────────────────
           DESKTOP LAYOUT (md and above)
           Left: foto list | Center: canvas | Right: controls
          ────────────────────────────────────────────────── */}

      {/* ─── DESKTOP KIRI: Daftar Foto ─── */}
      <div className="hidden md:flex md:w-[20%] md:min-w-[200px] md:max-w-[280px] bg-[#FFFDF7] border-r-4 border-slate-900 flex-col h-full z-30">
        <div className="p-4 pt-18 border-b-4 border-slate-900 shrink-0 bg-indigo-500">
          <h2 className="text-xl font-black text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">Foto Kamu</h2>
          <p className="text-indigo-100 text-xs font-bold mt-1">Seret ke slot atau klik untuk isi</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {capturedPhotos.map((photo, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, photo.url)}
              onClick={() => handlePhotoTap(photo.url)}
              className="relative w-full shrink-0 bg-slate-200 border-4 border-slate-900 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] transition-all"
              style={{ height: '140px' }}
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
          {printCount > 1 && (
            <div className="mt-4 flex gap-2 items-center justify-center w-full">
              <button
                onClick={() => { setActivePrintIndex(p => Math.max(0, p - 1)); setActiveSlotIndex(null); }}
                disabled={activePrintIndex === 0}
                className="p-1.5 rounded-full border-2 border-slate-900 disabled:opacity-30 bg-white hover:bg-slate-100 transition-colors shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {Array.from({ length: printCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setActivePrintIndex(i); setActiveSlotIndex(null); }}
                    className={`px-3 py-1 rounded-full font-black text-xs border-2 border-slate-900 shrink-0 transition-colors ${
                      activePrintIndex === i
                        ? 'bg-[#8A2BE2] text-white'
                        : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Cetakan {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setActivePrintIndex(p => Math.min(printCount - 1, p + 1)); setActiveSlotIndex(null); }}
                disabled={activePrintIndex === printCount - 1}
                className="p-1.5 rounded-full border-2 border-slate-900 disabled:opacity-30 bg-white hover:bg-slate-100 transition-colors shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden py-2" onClick={() => setActiveSlotIndex(null)}>
          <div className="relative h-full aspect-auto inline-block shadow-[8px_8px_0px_0px_rgba(30,41,59,1)] border-4 border-slate-900 rounded-xl bg-white" style={{ containerType: 'inline-size' }} onClick={(e) => e.stopPropagation()}>
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
                    zIndex: slot.type === 'text' ? (isActive ? 30 : 20) : (isActive ? 15 : 5),
                  }}
                  className={`overflow-hidden flex items-center justify-center relative transition-all cursor-pointer ${
                    slot.type === 'text' ? 'bg-transparent' : 'bg-slate-200'
                  } ${isActive ? 'ring-4 ring-indigo-500 ring-offset-2 shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'hover:ring-2 hover:ring-indigo-300'}`}
                >
                  {slot.type === 'text' ? (
                    <div
                      className="w-full h-full flex items-center justify-center pointer-events-none p-1"
                      style={{
                        fontFamily: slot.fontFamily || 'Inter',
                        color: slot.color || '#000000',
                        fontSize: slot.fontSize ? `${(slot.fontSize / 400) * 100}cqw` : '6cqw',
                      }}
                    >
                      <span className="truncate font-bold w-full text-center">
                        {data?.textValue || (isActive ? '|  ketik disini  |' : 'Your Text Here')}
                      </span>
                    </div>
                  ) : data?.photoUrl ? (
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
                        filter: selectedFrame?.is_bw ? 'grayscale(100%)' : 'none',
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
              className="h-full w-auto block relative z-10 pointer-events-none rounded-lg"
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
            <div className={`p-6 border-b-4 border-slate-900 shrink-0 ${isActiveText ? 'bg-violet-500' : 'bg-amber-400'}`}>
              <h2 className="text-2xl font-black text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                {isActiveText ? (
                  <span className="flex items-center gap-2"><Type className="w-6 h-6" /> Teks Slot {activeSlotIndex + 1}</span>
                ) : (
                  `Edit Slot ${activeSlotIndex + 1}`
                )}
              </h2>
              <p className="text-white/90 text-sm font-extrabold mt-1">
                {isActiveText ? 'Masukkan teks kustom Anda.' : 'Atur posisi dan ukuran foto di slot ini.'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {isActiveText ? (
                /* ── TEXT SLOT CONTROLS (Desktop) ── */
                <div className="flex flex-col gap-4">
                  <div className="bg-white border-4 border-slate-900 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <label className="font-black text-slate-900 flex items-center gap-2">
                        <Type className="w-4 h-4 text-violet-600" />
                        Custom Text
                      </label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-300">
                        {(activeData.textValue || '').length}/{activeCoord?.maxChars || 200}
                      </span>
                    </div>
                    <textarea
                      value={activeData.textValue || ''}
                      onChange={(e) => handleTextChange(activeSlotIndex, e.target.value)}
                      placeholder="Ketik teks kustom di sini..."
                      rows={3}
                      maxLength={activeCoord?.maxChars || 200}
                      className="w-full p-3 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-violet-500 font-semibold text-sm resize-none leading-relaxed"
                      style={{
                        fontFamily: activeCoord?.fontFamily || 'Inter',
                        color: activeCoord?.color || '#000000',
                        fontSize: activeCoord?.fontSize ? `${activeCoord.fontSize}px` : '14px',
                      }}
                    />
                    <div className="flex flex-col gap-1 p-3 bg-violet-50 rounded-lg border border-violet-200">
                      <p className="text-[11px] font-black text-violet-700 uppercase">Preview Style</p>
                      <p className="text-[11px] text-violet-600">
                        Font: <strong>{activeCoord?.fontFamily || 'Inter'}</strong> &bull; Ukuran: <strong>{activeCoord?.fontSize || 'auto'}px</strong> &bull; Max: <strong>{activeCoord?.maxChars || 200} karakter</strong>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── PHOTO SLOT CONTROLS (Desktop) ── */
                <>
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
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-50">
            <MousePointerClick className="w-16 h-16 text-slate-400 mb-4" />
            <h3 className="text-xl font-black text-slate-600 mb-2">Pilih Slot</h3>
            <p className="font-bold text-slate-500">Klik slot foto atau teks di area tengah untuk mulai mengedit.</p>
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
          <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center px-4 pt-14 pb-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
            <div className="flex items-center justify-between w-full">
              <span className="text-white font-black text-sm tracking-wide">Penempatan Foto</span>
              {activeSlotIndex !== null && (
                <span className={`font-black text-xs px-3 py-1 rounded-full border-2 border-slate-900 ${isActiveText ? 'bg-violet-400 text-white' : 'bg-amber-400 text-slate-900'}`}>
                  {isActiveText ? `✏️ TEKS ${activeSlotIndex + 1}` : `SLOT ${activeSlotIndex + 1} AKTIF`}
                </span>
              )}
            </div>
            {printCount > 1 && (
              <div className="flex gap-2 items-center w-full mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePrintIndex(p => Math.max(0, p - 1)); setActiveSlotIndex(null); }}
                  disabled={activePrintIndex === 0}
                  className="p-1 rounded-full border-2 border-white/60 disabled:opacity-30 bg-white/20 backdrop-blur hover:bg-white/30 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex gap-1.5 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                  {Array.from({ length: printCount }).map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setActivePrintIndex(i); setActiveSlotIndex(null); }}
                      className={`px-3 py-1 rounded-full font-black text-[10px] border-2 shrink-0 transition-colors ${
                        activePrintIndex === i
                          ? 'bg-[#8A2BE2] text-white border-[#8A2BE2]'
                          : 'bg-white/20 text-white border-white/40 backdrop-blur hover:bg-white/30'
                      }`}
                    >
                      Cetakan {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePrintIndex(p => Math.min(printCount - 1, p + 1)); setActiveSlotIndex(null); }}
                  disabled={activePrintIndex === printCount - 1}
                  className="p-1 rounded-full border-2 border-white/60 disabled:opacity-30 bg-white/20 backdrop-blur hover:bg-white/30 transition-colors shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Frame + Slots Container */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center py-4 relative z-10">
            <div
              className="relative h-full aspect-auto inline-block rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-slate-800 bg-white"
              style={{ containerType: 'inline-size' }}
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
                    zIndex: slot.type === 'text' ? (isActive ? 30 : 25) : (isActive ? 15 : 5),
                  }}
                  className={`overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
                    slot.type === 'text' ? 'bg-transparent' : 'bg-slate-300'
                  } ${isActive ? `ring-4 ring-offset-1 ${slot.type === 'text' ? 'ring-violet-400' : 'ring-amber-400'}` : ''}`}
                >
                  {slot.type === 'text' ? (
                    <div
                      className="w-full h-full flex items-center justify-center pointer-events-none p-1"
                      style={{
                        fontFamily: slot.fontFamily || 'Inter',
                        color: slot.color || '#000000',
                        fontSize: slot.fontSize ? `${(slot.fontSize / 400) * 100}cqw` : '6cqw',
                      }}
                    >
                      <span className="truncate font-bold w-full text-center">
                        {data?.textValue || (isActive ? '|  ketik disini  |' : 'Your Text')}
                      </span>
                    </div>
                  ) : data?.photoUrl ? (
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
                        filter: selectedFrame?.is_bw ? 'grayscale(100%)' : 'none',
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
              className="h-full w-auto block relative pointer-events-none rounded-xl"
              style={{ zIndex: 20 }}
              onLoad={() => {
                if (frameImgRef.current) {
                  setFrameImgSize({ w: frameImgRef.current.offsetWidth, h: frameImgRef.current.offsetHeight });
                }
              }}
            />
            </div>
          </div>
        </div>

        {/* ── 2. HORIZONTAL PHOTO STRIP (scroll samping) ── */}
        <div className="shrink-0 bg-[#111118] border-t-2 border-slate-700 z-20 relative">
          <div className="px-3 pt-2 pb-1 flex items-center gap-2">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Foto Kamu</span>
            {activeSlotIndex !== null && !isActiveText && (
              <span className="text-amber-400 text-[10px] font-black">— ketuk foto untuk isi Slot {activeSlotIndex + 1}</span>
            )}
            {activeSlotIndex !== null && isActiveText && (
              <span className="text-violet-400 text-[10px] font-black">— ketuk slot teks di atas untuk mengetik</span>
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
        <div className="shrink-0 bg-[#FFFDF7] border-t-4 border-slate-900 z-30" style={{ maxHeight: '40dvh', overflowY: 'auto' }}>
          {activeSlotIndex !== null && activeData ? (
            <div className="p-4 flex flex-col gap-3">
              {/* Header kontrol */}
              <div className="flex items-center justify-between">
                <span className={`font-black text-base flex items-center gap-2 ${isActiveText ? 'text-violet-700' : 'text-slate-900'}`}>
                  {isActiveText ? <><Type className="w-4 h-4" /> Teks Slot {activeSlotIndex + 1}</> : `Edit Slot ${activeSlotIndex + 1}`}
                </span>
                <button
                  onClick={() => setActiveSlotIndex(null)}
                  className="text-xs font-bold text-slate-500 border-2 border-slate-300 rounded-lg px-2 py-1 hover:bg-slate-100"
                >
                  Tutup
                </button>
              </div>

              {isActiveText ? (
                /* ── TEXT SLOT CONTROLS (Mobile) ── */
                <div className="flex flex-col gap-2 bg-violet-50 p-3 rounded-xl border-2 border-violet-200">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-violet-700 uppercase">Teks Kustom</label>
                    <span className="text-[10px] font-bold text-violet-500 bg-white px-2 py-0.5 rounded-full border border-violet-200">
                      {(activeData.textValue || '').length}/{activeCoord?.maxChars || 200} karakter
                    </span>
                  </div>
                  <textarea
                    value={activeData.textValue || ''}
                    onChange={(e) => handleTextChange(activeSlotIndex, e.target.value)}
                    placeholder="Ketik teks kustom di sini..."
                    rows={2}
                    maxLength={activeCoord?.maxChars || 200}
                    className="w-full p-2.5 border-2 border-violet-300 rounded-xl focus:outline-none focus:border-violet-500 font-semibold text-sm resize-none leading-relaxed bg-white"
                    style={{
                      fontFamily: activeCoord?.fontFamily || 'Inter',
                      color: activeCoord?.color || '#000000',
                      fontSize: activeCoord?.fontSize ? `${activeCoord.fontSize}px` : '14px',
                    }}
                    autoFocus
                  />
                  {activeCoord?.fontFamily && (
                    <p className="text-[10px] text-violet-500 font-medium">
                      Font: {activeCoord.fontFamily}
                      {activeCoord.fontSize ? ` • ${activeCoord.fontSize}px` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : (
            <div className="p-4 flex items-center gap-3 text-slate-500">
              <MousePointerClick className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold">Ketuk slot foto atau teks di preview atas untuk mengatur.</p>
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
