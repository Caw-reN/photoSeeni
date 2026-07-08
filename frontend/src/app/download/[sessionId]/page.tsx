'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { sessionsApi } from '@/lib/api';
import { Download, Camera, Image as ImageIcon, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// @ts-ignore
let gifshot: any;
if (typeof window !== 'undefined') {
  gifshot = require('gifshot');
}

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.startsWith('/')) return apiUrl.replace('/api', '');
  return '';
})();

const getImageUrl = (pathOrUrl: string | undefined) => {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

const proxyImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('/')) return url; // relative — Next.js rewrite handles it
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

type SlotCoordinate = {
  x?: number; y?: number; width?: number; height?: number;
  x_percent?: number; y_percent?: number; width_percent?: number; height_percent?: number;
};

type SlotData = {
  photoUrl: string; scale: number; rotate: number; translateX: number; translateY: number;
};

export default function DownloadPage() {
  const { sessionId } = useParams();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Strip rendering state
  const [coordinates, setCoordinates] = useState<SlotCoordinate[]>([]);
  const [slotsData, setSlotsData] = useState<SlotData[]>([]);
  const [frameImageUrl, setFrameImageUrl] = useState<string | null>(null);
  const [frameId, setFrameId] = useState<number | null>(null);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [slotOrientations, setSlotOrientations] = useState<Record<number, 'landscape' | 'portrait'>>({});

  // GIF state
  const [gifLoading, setGifLoading] = useState(false);
  const [gifDataUrl, setGifDataUrl] = useState<string | null>(null);
  const frameImgRef = useRef<HTMLImageElement>(null);
  const hasRendered = useRef(false);

  // ── Helper: load gambar via proxy (bypass ngrok CORS & browser warning) ──
  const loadImageFromUrl = useCallback(async (url: string): Promise<HTMLImageElement> => {
    // Route melalui Next.js proxy agar header ngrok-skip dikirim dari server
    const proxied = url.startsWith('/api/proxy-image') ? url : proxyImageUrl(url);

    const response = await fetch(proxied);
    if (!response.ok) throw new Error(`HTTP ${response.status} saat load: ${url}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Gagal decode: ${url}`)); };
      img.src = objectUrl;
    });
  }, []);

  // ── GIF Generator ──
  const generateGif = useCallback(async (photos: any[]) => {
    if (!photos || photos.length === 0) return;
    setGifLoading(true);
    try {
      const imageUrls: string[] = [];
      
      // Load all raw images and draw on a canvas to produce base64 Data URLs
      for (const photo of photos) {
        if (!photo?.url) continue;
        try {
          const img = await loadImageFromUrl(photo.url);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            imageUrls.push(canvas.toDataURL('image/jpeg', 0.8));
          }
        } catch (loadErr) {
          console.error('Gagal memuat foto mentahan untuk GIF:', loadErr);
        }
      }

      if (imageUrls.length > 0 && gifshot) {
        gifshot.createGIF({
          images: imageUrls,
          gifWidth: 640,
          gifHeight: 480,
          interval: 0.15, // 0.15 seconds per frame (150ms)
          numFrames: imageUrls.length,
          frameDuration: 1.5, // 150ms (in 100ms units)
        }, (obj: any) => {
          if (!obj.error) {
            setGifDataUrl(obj.image);
          } else {
            console.error('Gifshot error:', obj.error);
            toast.error('Gagal membuat animasi GIF.');
          }
          setGifLoading(false);
        });
      } else {
        setGifLoading(false);
      }
    } catch (err) {
      console.error('GIF generation error:', err);
      setGifLoading(false);
    }
  }, [loadImageFromUrl]);

  const handleDownloadGif = () => {
    if (!gifDataUrl) return;
    const a = document.createElement('a');
    a.href = gifDataUrl;
    a.download = `fotoseeni-poses-${session?.id || 'session'}.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Animasi GIF berhasil diunduh!');
  };

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionsApi.get(sessionId as string);
      setSession(data);

      if (data.frame) {
        // Parse coordinates
        let coords: SlotCoordinate[] = [];
        try {
          const raw = data.frame.coordinates;
          if (raw) {
            coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } else if (Array.isArray(data.frame.slots)) {
            coords = data.frame.slots;
          }
        } catch (e) { console.error('Coordinate parse error', e); }
        coords = Array.isArray(coords) ? coords : [];
        setCoordinates(coords);

        const fId = data.frame.id ?? null;
        setFrameId(fId);
        if (fId) {
          setFrameImageUrl(proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${fId}/image`));
        } else if (data.frame.image_url) {
          setFrameImageUrl(proxyImageUrl(data.frame.image_url));
        } else {
          setFrameImageUrl(proxyImageUrl(getImageUrl(data.frame.image_path)));
        }

        // Sort photos by slot_index
        const sorted: any[] = data.photos
          ? [...data.photos].sort((a: any, b: any) => a.slot_index - b.slot_index)
          : [];

        // Build slots data with defaults (no localStorage on download page)
        const built: SlotData[] = coords.map((_, i) => ({
          photoUrl: sorted[i]?.url ? proxyImageUrl(sorted[i].url) : '',
          scale: 1, rotate: 0, translateX: 0, translateY: 0,
        }));
        setSlotsData(built);

        // Trigger GIF generation
        if (sorted.length > 0) {
          generateGif(sorted);
        }
      }
    } catch (_) {
      setError('Gagal memuat hasil sesi foto. Pastikan URL benar.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, generateGif]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // ── Canvas render — skip if server already has final_image_url (correct with edits) ──
  const renderToCanvas = useCallback(async () => {
    if (hasRendered.current) return;

    // If the server already has a final composited image (uploaded by checkout),
    // use it directly — it already contains the user's edits (rotate, scale, translate)
    if (session?.final_image_url) {
      hasRendered.current = true;
      setIsRendering(true);
      try {
        const response = await fetch(proxyImageUrl(session.final_image_url));
        if (!response.ok) throw new Error('Gagal mengambil final image dari server');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        // Convert to data URL for download
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('Gagal decode final image'));
          img.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        setCanvasDataUrl(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err: any) {
        console.error('Final image fetch error:', err);
        // Fallback to re-render below
        hasRendered.current = false;
      } finally {
        setIsRendering(false);
      }
      return;
    }

    if (!frameImgRef.current || coordinates.length === 0 || slotsData.length === 0) return;
    const frameEl = frameImgRef.current;
    if (!frameEl.complete || frameEl.naturalWidth === 0) return;

    hasRendered.current = true;
    setIsRendering(true);
    setRenderError(null);

    const objectUrls: string[] = [];
    try {
      const canvas = document.createElement('canvas');
      canvas.width = frameEl.naturalWidth || 1200;
      canvas.height = frameEl.naturalHeight || 1800;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Gagal mendapatkan canvas context');

      const scaleRatio = canvas.width / (frameEl.clientWidth || 300);

      // Gambar foto ke slot masing-masing via blob (tidak tainted)
      for (let i = 0; i < coordinates.length; i++) {
        const slot = coordinates[i];
        const data = slotsData[i];
        if (!data?.photoUrl) continue;

        const img = await loadImageFromUrl(data.photoUrl);
        if (img.src.startsWith('blob:')) objectUrls.push(img.src);

        const x = ((slot.x_percent ?? slot.x ?? 0) / 100) * canvas.width;
        const y = ((slot.y_percent ?? slot.y ?? 0) / 100) * canvas.height;
        const w = ((slot.width_percent ?? slot.width ?? 0) / 100) * canvas.width;
        const h = ((slot.height_percent ?? slot.height ?? 0) / 100) * canvas.height;
        const scaleToCover = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const drawW = img.naturalWidth * scaleToCover;
        const drawH = img.naturalHeight * scaleToCover;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((data.rotate * Math.PI) / 180);
        ctx.scale(data.scale, data.scale);
        ctx.translate(data.translateX * scaleRatio, data.translateY * scaleRatio);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      // Gambar frame overlay di atas via proxy
      const frameSrc = frameId
        ? proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${frameId}/image`)
        : proxyImageUrl(frameEl.src);
      const frameOverlay = await loadImageFromUrl(frameSrc);
      if (frameOverlay.src.startsWith('blob:')) objectUrls.push(frameOverlay.src);

      ctx.drawImage(frameOverlay, 0, 0, canvas.width, canvas.height);
      setCanvasDataUrl(canvas.toDataURL('image/jpeg', 0.95));
    } catch (err: any) {
      console.error('Canvas render error:', err);
      setRenderError(err?.message || 'Gagal merender strip. Coba lagi.');
      hasRendered.current = false;
    } finally {
      // Bersihkan object URLs agar tidak bocor memori
      objectUrls.forEach(u => URL.revokeObjectURL(u));
      setIsRendering(false);
    }
  }, [coordinates, slotsData, frameId, loadImageFromUrl, session?.final_image_url]);

  const handleFrameLoad = useCallback(() => { renderToCanvas(); }, [renderToCanvas]);

  // ── Download handlers ─────────────────────────────────────────────────────
  const handleDownloadStrip = () => {
    // Hanya download dari canvas (benar) — jangan fallback ke server image yang salah
    if (!canvasDataUrl) return;
    const a = document.createElement('a');
    a.href = canvasDataUrl;
    a.download = `fotoseeni-strip-${session?.id || 'photo'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadRaw = (photoId: number, index: number) => {
    const a = document.createElement('a');
    a.href = `${BACKEND_URL}/api/photos/${photoId}/download`;
    a.download = `fotoseeni-raw-${index + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllRaw = () => {
    if (!session?.photos) return;
    session.photos.forEach((photo: any, index: number) => {
      setTimeout(() => handleDownloadRaw(photo.id, index), index * 300);
    });
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#FFFDF7] p-6">
        <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin mb-4" />
        <h2 className="text-xl font-black text-[#1D1D23] uppercase">Memuat Foto Anda...</h2>
        <p className="text-gray-500 font-bold text-xs mt-1 uppercase tracking-wider">Sedang menyiapkan berkas unduhan</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#FFFDF7] p-6">
        <div className="neobrutal-box bg-white p-8 max-w-md w-full border-4 border-slate-900 shadow-[8px_8px_0px_#1D1D23] text-center">
          <div className="w-16 h-16 bg-red-100 border-3 border-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Error Terjadi</h2>
          <p className="text-gray-500 font-bold text-sm mt-2">{error || 'Sesi foto tidak ditemukan.'}</p>
          <button
            onClick={fetchSession}
            className="neobrutal-button mt-6 w-full py-3 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] font-extrabold uppercase text-sm"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const sortedPhotos: any[] = session.photos
    ? [...session.photos].sort((a: any, b: any) => a.slot_index - b.slot_index)
    : [];

  const canShowLayered = frameImageUrl && coordinates.length > 0 && slotsData.length > 0 && !session?.final_image_url;
  const hasStrip = canvasDataUrl || session?.final_image_url;

  return (
    <div className="min-h-screen bg-[#FFFDF7] py-10 px-4 flex flex-col items-center">

      {/* ── Header ── */}
      <div className="text-center mb-10 max-w-xl">
        <div className="inline-block px-4 py-1.5 bg-[#8A2BE2] text-white font-black text-xs uppercase rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#000] mb-3">
          fotoseeni Download Center
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[#1D1D23] tracking-tight uppercase">
          Unduh Hasil Foto Anda
        </h1>
        <p className="text-sm text-gray-500 font-extrabold uppercase mt-2 tracking-wider">
          Simpan kenangan indah Anda langsung ke galeri HP
        </p>
      </div>

      <div className="max-w-5xl w-full flex flex-col lg:flex-row gap-8 items-stretch">

        {/* ══════════════════════════════════════════════
            KOLOM KIRI — Showcase Strip Foto
            ══════════════════════════════════════════════ */}
        <div className="w-full lg:w-[360px] flex flex-col items-center flex-shrink-0">
          <div className="neobrutal-box bg-white p-5 border-4 border-slate-900 rounded-2xl shadow-[6px_6px_0px_#1D1D23] w-full h-full flex flex-col justify-between">
            <div>
              <div className="text-center mb-4">
                <span className="bg-violet-600 text-white font-black text-[10px] px-3.5 py-1.5 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#000] uppercase tracking-wider">
                  Foto Strip Hasil Akhir
                </span>
              </div>

              {canShowLayered ? (
                // Layered rendering: foto di slot + frame overlay (sama seperti checkout & result)
                <div className="relative inline-block overflow-hidden w-full rounded-lg border-2 border-slate-900">
                  {coordinates.map((slot, index) => {
                    const data = slotsData[index];
                    return (
                      <div
                        key={index}
                        style={{
                          position: 'absolute',
                          left: `${slot.x_percent ?? slot.x ?? 0}%`,
                          top: `${slot.y_percent ?? slot.y ?? 0}%`,
                          width: `${slot.width_percent ?? slot.width ?? 0}%`,
                          height: `${slot.height_percent ?? slot.height ?? 0}%`,
                        }}
                        className="overflow-hidden flex items-center justify-center relative bg-slate-200"
                      >
                        {data?.photoUrl && (
                          <img
                            src={data.photoUrl}
                            alt={`Slot ${index + 1}`}
                            className="absolute max-w-none"
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
                        )}
                      </div>
                    );
                  })}
                  {/* Frame PNG — ref untuk canvas renderer */}
                  <img
                    ref={frameImgRef}
                    src={frameImageUrl!}
                    alt="Frame Overlay"
                    onLoad={handleFrameLoad}
                    className="w-full h-auto block relative z-10 pointer-events-none"
                  />
                </div>
              ) : session?.final_image_url ? (
                <img
                  src={proxyImageUrl(session.final_image_url)}
                  alt="Final Photo Strip"
                  onLoad={() => renderToCanvas()}
                  className="w-full h-auto object-contain border-2 border-slate-900 rounded-xl"
                />
              ) : (
                <div className="aspect-[1/3] w-full bg-slate-100 flex items-center justify-center border-2 border-slate-900 rounded-xl">
                  <p className="text-slate-400 font-bold text-center text-sm p-4">Foto strip belum selesai diproses.</p>
                </div>
              )}
            </div>

            {/* Canvas status & Error handling */}
            <div className="mt-4 flex flex-col items-center">
              <div className="flex justify-center min-h-[18px]">
                {isRendering && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <Loader2 className="w-3 h-3 animate-spin" /> Merender HD...
                  </span>
                )}
                {canvasDataUrl && !isRendering && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 border-2 border-emerald-400 px-3 py-1 rounded-full uppercase tracking-wider shadow-[2px_2px_0px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="w-3 h-3" /> HD Ready
                  </span>
                )}
                {renderError && !isRendering && (
                  <button
                    onClick={() => { hasRendered.current = false; renderToCanvas(); }}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-amber-500 hover:underline uppercase tracking-wider"
                  >
                    <RefreshCw className="w-3 h-3" /> Coba render ulang
                  </button>
                )}
              </div>

              {renderError && (
                <div className="mt-3 w-full bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 font-bold">
                    {renderError}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            KOLOM KANAN — GIF Animasi & Panel Kontrol
            ══════════════════════════════════════════════ */}
        <div className="flex-1 w-full flex flex-col gap-6 justify-between">
          
          {/* ── GIF Animasi Box (Vintage Monitor Style) ── */}
          <div className="neobrutal-box bg-white p-5 border-4 border-slate-900 rounded-2xl shadow-[6px_6px_0px_#1D1D23] w-full flex-1 flex flex-col justify-between">
            <div>
              <div className="text-center mb-4">
                <span className="bg-[#FF7F50] text-[#1D1D23] font-black text-[10px] px-3.5 py-1.5 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#000] uppercase tracking-wider">
                  GIF Animasi Poses
                </span>
              </div>
              
              {gifLoading ? (
                <div className="aspect-[4/3] w-full bg-slate-50 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 text-center">
                  <Loader2 className="w-8 h-8 text-[#8A2BE2] animate-spin mb-2" />
                  <p className="text-slate-400 text-xs font-bold uppercase">Membuat Animasi GIF...</p>
                </div>
              ) : gifDataUrl ? (
                <div className="aspect-[4/3] w-full bg-slate-100 border-2 border-slate-900 rounded-xl overflow-hidden relative shadow-inner">
                  <img
                    src={gifDataUrl}
                    alt="Animasi Poses"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] w-full bg-slate-100 flex items-center justify-center border-2 border-slate-900 rounded-xl">
                  <p className="text-slate-400 font-bold text-center text-xs p-4">Tidak ada foto untuk GIF.</p>
                </div>
              )}
            </div>
            
            <p className="text-gray-400 text-[10px] font-bold text-center uppercase tracking-widest mt-3">
              *Berisi kumpulan semua pose foto dalam 1 animasi
            </p>
          </div>

          {/* ── Pusat Unduhan & Aksi ── */}
          <div className="neobrutal-box bg-violet-50 p-5 border-4 border-slate-900 rounded-2xl shadow-[6px_6px_0px_#1D1D23] w-full flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b-2 border-dashed border-slate-300 pb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#8A2BE2]" />
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                Control Panel / Pusat Unduhan
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Unduh Strip HD */}
              {(isRendering || canShowLayered || session.final_image_url) && (
                <button
                  onClick={handleDownloadStrip}
                  disabled={isRendering || !canvasDataUrl}
                  className="neobrutal-button flex-1 py-4 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] font-extrabold text-sm border-3 border-slate-900 shadow-[3px_3px_0px_#1D1D23] flex items-center justify-center gap-2.5 uppercase cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isRendering ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Merender...</>
                  ) : canvasDataUrl ? (
                    <><Download className="w-4 h-4" /> Unduh Strip HD</>
                  ) : (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan...</>
                  )}
                </button>
              )}

              {/* Unduh GIF Animasi */}
              {gifDataUrl && (
                <button
                  onClick={handleDownloadGif}
                  className="neobrutal-button flex-1 py-4 bg-[#FF7F50] text-[#1D1D23] hover:bg-[#ff8e66] font-black text-sm border-3 border-slate-900 shadow-[3px_3px_0px_#1D1D23] flex items-center justify-center gap-2.5 uppercase cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Unduh GIF Poses
                  <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                </button>
              )}
            </div>

            {sortedPhotos.length > 1 && (
              <button
                onClick={handleDownloadAllRaw}
                className="neobrutal-button w-full py-3 bg-white text-[#1D1D23] hover:bg-slate-50 border-3 border-slate-900 shadow-[3px_3px_0px_#1D1D23] font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Unduh Semua Foto Mentahan ({sortedPhotos.length})
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SEKSYEN BAWAH — Foto Mentahan Individual (Polaroid Grid)
          ══════════════════════════════════════════════ */}
      <div className="max-w-5xl w-full mt-14 border-t-4 border-dashed border-slate-300 pt-10">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 border-2 border-slate-900 rounded-lg">
              <Camera className="w-5 h-5 text-[#1D1D23]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1D1D23] uppercase tracking-wide">Foto Mentahan Individual</h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Simpan pose favorit Anda satu per satu</p>
            </div>
          </div>
          {sortedPhotos.length > 1 && (
            <button
              onClick={handleDownloadAllRaw}
              className="neobrutal-button px-5 py-3 bg-white text-[#1D1D23] hover:bg-slate-50 border-3 border-slate-900 shadow-[3px_3px_0px_#1D1D23] font-black text-xs uppercase flex items-center gap-2 cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" /> Unduh Semua Poses
            </button>
          )}
        </div>

        {sortedPhotos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {sortedPhotos.map((photo: any, index: number) => {
              const rotationClass = index % 2 === 0 ? '-rotate-1 hover:rotate-0' : 'rotate-1 hover:rotate-0';
              return (
                <div
                  key={photo.id || index}
                  className={`bg-white p-3 pb-5 border-4 border-slate-900 shadow-[4px_4px_0px_#1D1D23] rounded-xl flex flex-col justify-between transition-all duration-300 ${rotationClass} hover:-translate-y-2 hover:shadow-[6px_6px_0px_#1D1D23] cursor-pointer`}
                >
                  <div>
                    {/* Polaroid Photo Frame */}
                    <div className="aspect-[4/3] bg-slate-100 border-2 border-slate-900 rounded-lg overflow-hidden relative shadow-inner">
                      <img
                        src={proxyImageUrl(photo.url)}
                        alt={`Raw Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Handwriting style label */}
                    <div className="text-center mt-3 mb-1">
                      <span className="font-mono text-xs font-black text-slate-800 tracking-wider uppercase bg-slate-100 px-3 py-1 rounded border border-slate-300">
                        Pose #{index + 1}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadRaw(photo.id, index)}
                    className="neobrutal-button mt-3 w-full py-2 bg-emerald-500 text-white hover:bg-emerald-600 border-2 border-slate-900 shadow-[2px_2px_0px_#1D1D23] flex items-center justify-center gap-1.5 text-[10px] font-black uppercase cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh Pose
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="neobrutal-box bg-white p-8 border-4 border-slate-900 text-center shadow-[4px_4px_0px_#1D1D23] rounded-xl">
            <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-slate-400 font-bold text-sm">Tidak ada foto mentahan yang tersedia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
