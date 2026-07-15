'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionsApi } from '@/lib/api';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import {
  Download,
  Share2,
  Home,
  Loader2,
  CheckCircle2,
  Camera,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.startsWith('/')) return (apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl);
  return '';
})();

const getImageUrl = (pathOrUrl: string | undefined) => {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

const proxyImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('/')) return url; // relative URL — Next.js rewrites handle it
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

type SlotCoordinate = {
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

type SlotData = {
  photoUrl: string;
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
  textValue?: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ResultPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const { width, height } = useWindowSize();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  const [coordinates, setCoordinates] = useState<SlotCoordinate[]>([]);
  // slotsDataList: array per print, each containing slot data
  const [slotsDataList, setSlotsDataList] = useState<SlotData[][]>([]);
  const [frameImageUrl, setFrameImageUrl] = useState<string | null>(null);
  const [frameId, setFrameId] = useState<number | null>(null);
  const [isBw, setIsBw] = useState(false);
  const [slotOrientations, setSlotOrientations] = useState<Record<string, 'landscape' | 'portrait'>>({});

  // Canvas rendered results per print index
  const [canvasDataUrls, setCanvasDataUrls] = useState<(string | null)[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const frameImgRef = useRef<HTMLImageElement>(null);
  const hasRendered = useRef(false);

  // Active print tab in preview (for multi-print)
  const [activePrintTab, setActivePrintTab] = useState(0);

  // ── Fetch session ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await sessionsApi.get(sessionId as string);
        setSession(data);

        if (data.frame) {
          let coords: SlotCoordinate[] = [];
          try {
            const raw = data.frame.coordinates;
            if (raw) {
              coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } else if (Array.isArray(data.frame.slots)) {
              coords = data.frame.slots;
            }
          } catch (e) {
            console.error('Failed to parse coordinates', e);
          }
          coords = Array.isArray(coords) ? coords : [];
          setCoordinates(coords);
          setIsBw(!!data.frame.is_bw);

          const fId = data.frame.id ?? null;
          setFrameId(fId);
          if (fId) {
            setFrameImageUrl(proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${fId}/image`));
          } else if (data.frame.image_url) {
            setFrameImageUrl(proxyImageUrl(data.frame.image_url));
          } else {
            setFrameImageUrl(proxyImageUrl(getImageUrl(data.frame.image_path)));
          }

          const sortedPhotos: any[] = data.photos
            ? [...data.photos].sort((a: any, b: any) => a.slot_index - b.slot_index)
            : [];

          // Try to recover adjustments from localStorage if still available
          // Support arranged_slots_list (multi-print) and arranged_slots (legacy)
          let savedList: SlotData[][] | null = null;
          try {
            const storedList = localStorage.getItem('arranged_slots_list');
            if (storedList) {
              savedList = JSON.parse(storedList);
            } else {
              const stored = localStorage.getItem('arranged_slots');
              if (stored) savedList = [JSON.parse(stored)];
            }
          } catch (_) {}

          const printCount = savedList ? savedList.length : 1;

          const builtList: SlotData[][] = Array.from({ length: printCount }, (_, printIndex) => {
            const saved = savedList ? savedList[printIndex] : null;
            let photoIdx = 0;
            return coords.map((coord, i) => {
              const savedSlot = saved?.[i];
              // For text slots, use textValue from saved data — don't consume a photo index
              if (coord.type === 'text') {
                return {
                  photoUrl: '',
                  scale: 1,
                  rotate: 0,
                  translateX: 0,
                  translateY: 0,
                  textValue: savedSlot?.textValue || '',
                };
              }
              // Photo slot: consume a photo from sortedPhotos
              const photo = sortedPhotos[photoIdx];
              photoIdx++;
              return {
                photoUrl: photo?.url ? proxyImageUrl(photo.url) : '',
                scale: savedSlot?.scale ?? 1,
                rotate: savedSlot?.rotate ?? 0,
                translateX: savedSlot?.translateX ?? 0,
                translateY: savedSlot?.translateY ?? 0,
              };
            });
          });

          setSlotsDataList(builtList);
          setCanvasDataUrls(new Array(printCount).fill(null));
        }
      } catch (err) {
        setError('Gagal memuat hasil photobooth.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [sessionId]);

  // ── Helper: load gambar via proxy (bypass ngrok CORS & browser warning) ──
  const loadImageFromUrl = useCallback(async (url: string): Promise<HTMLImageElement> => {
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

  // ── Canvas render — renders all prints ────────────────────────────────────
  const renderAllToCanvas = useCallback(async () => {
    if (hasRendered.current) return;
    if (!frameImgRef.current || coordinates.length === 0 || slotsDataList.length === 0) return;

    const frameEl = frameImgRef.current;
    if (!frameEl.complete || frameEl.naturalWidth === 0) return;

    hasRendered.current = true;
    setIsRendering(true);
    setRenderError(null);

    const results: (string | null)[] = new Array(slotsDataList.length).fill(null);

    const screenFrameWidth = frameEl.clientWidth || 300;

    for (let printIndex = 0; printIndex < slotsDataList.length; printIndex++) {
      const slotsData = slotsDataList[printIndex];
      const objectUrls: string[] = [];

      try {
        const canvas = document.createElement('canvas');
        canvas.width = frameEl.naturalWidth || 1200;
        canvas.height = frameEl.naturalHeight || 1800;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Gagal mendapatkan canvas context');

        const scaleRatio = canvas.width / screenFrameWidth;

        // Draw photos into slots
        for (let i = 0; i < coordinates.length; i++) {
          const slot = coordinates[i];
          const data = slotsData[i];
          if (!data || slot.type === 'text' || !data.photoUrl) continue;

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
          if (isBw) ctx.filter = 'grayscale(100%)';
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.filter = 'none';
          ctx.restore();
        }

        // Draw frame overlay on top via proxy
        const frameSrc = frameId
          ? proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${frameId}/image`)
          : proxyImageUrl(frameEl.src);
        const frameOverlay = await loadImageFromUrl(frameSrc);
        if (frameOverlay.src.startsWith('blob:')) objectUrls.push(frameOverlay.src);

        ctx.drawImage(frameOverlay, 0, 0, canvas.width, canvas.height);

        // Draw text slots on top of everything
        for (let i = 0; i < coordinates.length; i++) {
          const slot = coordinates[i];
          const data = slotsData[i];
          if (slot.type !== 'text' || !data || !data.textValue) continue;

          const x = ((slot.x_percent ?? slot.x ?? 0) / 100) * canvas.width;
          const y = ((slot.y_percent ?? slot.y ?? 0) / 100) * canvas.height;
          const w = ((slot.width_percent ?? slot.width ?? 0) / 100) * canvas.width;
          const h = ((slot.height_percent ?? slot.height ?? 0) / 100) * canvas.height;

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          
          let fontSize: number;
          if (slot.fontSize) {
            const previewW = 400;
            const canvasScale = canvas.width / previewW;
            fontSize = slot.fontSize * canvasScale;
          } else {
            fontSize = Math.min(h * 0.6, w * 0.15, 80);
          }
          ctx.font = `bold ${fontSize}px ${slot.fontFamily || 'Inter'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const textColor = slot.color || '#000000';
          ctx.fillStyle = textColor;
          ctx.strokeStyle = textColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
          ctx.lineWidth = Math.max(2, fontSize * 0.05);
          ctx.strokeText(data.textValue, x + w / 2, y + h / 2);
          
          ctx.fillText(data.textValue, x + w / 2, y + h / 2);
          ctx.restore();
        }
        results[printIndex] = canvas.toDataURL('image/jpeg', 0.95);
      } catch (err: any) {
        console.error(`Canvas render error for print ${printIndex}:`, err);
        setRenderError(err?.message || 'Gagal merender strip.');
        hasRendered.current = false;
      } finally {
        objectUrls.forEach(u => URL.revokeObjectURL(u));
      }
    }

    setCanvasDataUrls(results);
    // Clean up localStorage after rendering
    localStorage.removeItem('arranged_slots_list');
    localStorage.removeItem('arranged_slots');
    setIsRendering(false);
  }, [coordinates, slotsDataList, frameId, isBw, loadImageFromUrl]);

  const handleFrameLoad = useCallback(() => {
    renderAllToCanvas();
  }, [renderAllToCanvas]);

  // ── Download all strips ────────────────────────────────────────────────────
  const handleDownload = () => {
    // Priority: server-saved final_image_urls
    if (session?.final_image_urls && session.final_image_urls.length > 0) {
      session.final_image_urls.forEach((url: string, index: number) => {
        const a = document.createElement('a');
        a.href = proxyImageUrl(url);
        a.download = `fotoseeni-${session.id}-strip-${index + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
      return;
    }

    // Fallback: locally rendered canvas data URLs
    const rendered = canvasDataUrls.filter(Boolean);
    if (rendered.length > 0) {
      rendered.forEach((src, index) => {
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = `fotoseeni-${session?.id || 'strip'}-${index + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
      return;
    }

    // Final fallback: single final image
    const src = session?.final_image_url;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `fotoseeni-${session?.id || 'strip'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My fotoseeni Photo Strip!',
          text: 'Lihat foto booth saya dari fotoseeni!',
          url: window.location.href,
        });
      } catch (_) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link disalin ke clipboard!');
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#8A2BE2]" />
        <h2 className="text-xl font-bold text-[#1D1D23]">Developing your photos...</h2>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="neobrutal-box bg-red-50 p-8 max-w-md">
          <p className="text-red-600 font-bold text-lg">{error || 'Session not found'}</p>
          <button
            className="neobrutal-button mt-4 px-6 py-3 bg-[#8A2BE2] text-white"
            onClick={() => router.push('/')}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const canShowLayered = frameImageUrl && coordinates.length > 0 && slotsDataList.length > 0;

  let textQuery = '';
  if (slotsDataList[0] && coordinates.length > 0) {
    const customTexts: string[] = [];
    coordinates.forEach((slot, i) => {
      if (slot.type === 'text' && slotsDataList[0][i]?.textValue) {
        customTexts.push(slotsDataList[0][i].textValue as string);
      }
    });
    if (customTexts.length > 0) {
      textQuery = `?texts=${encodeURIComponent(JSON.stringify(customTexts))}`;
    }
  }

  const qrDownloadUrl = typeof window !== 'undefined'
    ? window.location.origin + '/download/' + sessionId + textQuery
    : '';

  // Determine the display mode
  // If we have server-saved final_image_urls with multiple strips
  const serverStrips: string[] = session?.final_image_urls ?? (session?.final_image_url ? [session.final_image_url] : []);
  const totalPrints = canShowLayered ? slotsDataList.length : serverStrips.length;
  const hasMultiplePrints = totalPrints > 1;

  const hasAnyRendered = canvasDataUrls.some(Boolean);
  const isDownloadReady = serverStrips.length > 0 || hasAnyRendered || !!session?.final_image_url;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 items-center py-12 px-6">
      {showConfetti && (
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
      )}

      {/* Heading */}
      <div className="text-center mb-8 animate-bounce">
        <h1 className="text-4xl md:text-5xl font-black text-[#1D1D23] uppercase tracking-tight">
          Woohoo! 🎉
        </h1>
        <p className="text-xl text-gray-600 mt-2 font-bold">
          {hasMultiplePrints ? `Your ${totalPrints} photo strips are ready!` : 'Your photo strip is ready!'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-12 items-center md:items-start max-w-5xl w-full justify-center">

        {/* ── Photo Strip(s) Preview ── */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs flex-shrink-0">

          {/* Print tabs (only shown when multiple) */}
          {hasMultiplePrints && (
            <div className="flex gap-2 items-center justify-center w-full">
              <button
                onClick={() => setActivePrintTab(p => Math.max(0, p - 1))}
                disabled={activePrintTab === 0}
                className="p-1.5 rounded-full border-2 border-slate-900 disabled:opacity-30 bg-white hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {Array.from({ length: totalPrints }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePrintTab(i)}
                    className={`px-3 py-1 rounded-full font-black text-xs border-2 border-slate-900 shrink-0 transition-colors ${
                      activePrintTab === i
                        ? 'bg-[#8A2BE2] text-white'
                        : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Cetakan {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActivePrintTab(p => Math.min(totalPrints - 1, p + 1))}
                disabled={activePrintTab === totalPrints - 1}
                className="p-1.5 rounded-full border-2 border-slate-900 disabled:opacity-30 bg-white hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stacked cards preview */}
          <div className="relative w-full max-w-[260px] mx-auto mt-4 mb-8">
            {/* Invisible placeholder to establish container height */}
            <div className="invisible pointer-events-none neobrutal-box p-4 border-4">
              <img src={frameImageUrl || serverStrips[0] || session?.final_image_url} alt="" className="w-full h-auto" />
            </div>

            {/* The actual fanned stacked cards */}
            {Array.from({ length: totalPrints }).map((_, printIndex) => {
              const isActive = activePrintTab === printIndex;
              const diff = printIndex - activePrintTab;
              const rotation = diff * 7; 
              const xOffset = diff * 20; 
              const yOffset = Math.abs(diff) * 8; 
              const zIndex = isActive ? 20 : 10 - Math.abs(diff);

              return (
                <div 
                  key={printIndex}
                  onClick={() => setActivePrintTab(printIndex)}
                  className={`absolute top-0 left-0 w-full neobrutal-box bg-white p-4 transition-all duration-500 cursor-pointer ${isActive ? 'shadow-[12px_12px_0px_#1D1D23] border-4' : 'shadow-[4px_4px_0px_rgba(29,29,35,0.4)] border-2 opacity-95 hover:opacity-100 hover:-translate-y-2'}`}
                  style={{
                    transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${isActive ? 1.05 : 0.95})`,
                    zIndex,
                    transformOrigin: 'bottom center'
                  }}
                >
                  {canShowLayered ? (() => {
                    const slotsData = slotsDataList[printIndex] ?? slotsDataList[0] ?? [];
                    return (
                      <div className="relative inline-block overflow-hidden w-full">
                        {coordinates.map((slot, index) => {
                          const data = slotsData[index];
                          const oriKey = `${printIndex}-${index}`;
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
                                  alt={`Photo Slot ${index + 1}`}
                                  className="absolute max-w-none"
                                  style={{
                                    top: '50%',
                                    left: '50%',
                                    ...(slotOrientations[oriKey] === 'landscape'
                                      ? { height: '100%', width: 'auto' }
                                      : { width: '100%', height: 'auto' }),
                                    transform: `translate(calc(-50% + ${data.translateX}px), calc(-50% + ${data.translateY}px)) scale(${data.scale}) rotate(${data.rotate}deg)`,
                                    transformOrigin: 'center center',
                                    filter: isBw ? 'grayscale(100%)' : 'none',
                                  }}
                                  onLoad={(e) => {
                                    const img = e.currentTarget;
                                    const ori = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
                                    setSlotOrientations(prev => ({ ...prev, [oriKey]: ori }));
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                        {/* Frame PNG — ref is used by canvas renderer for clientWidth (scaleRatio) */}
                        <img
                          ref={isActive ? frameImgRef : undefined}
                          src={frameImageUrl!}
                          alt="Frame Overlay"
                          onLoad={isActive ? handleFrameLoad : undefined}
                          className="w-full h-auto block relative z-10 pointer-events-none"
                        />
                      </div>
                    );
                  })() : serverStrips.length > 0 ? (
                    <img
                      src={serverStrips[printIndex] ?? serverStrips[0]}
                      alt={`Final Photobooth Strip ${printIndex + 1}`}
                      className="w-full h-auto object-cover border-2 border-[#1D1D23]"
                    />
                  ) : session.final_image_url ? (
                    <img
                      src={session.final_image_url}
                      alt="Final Photobooth Strip"
                      className="w-full h-auto object-cover border-2 border-[#1D1D23]"
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[...(session.photos || [])]
                        .sort((a: any, b: any) => a.slot_index - b.slot_index)
                        .map((photo: any) => (
                          <img
                            key={photo.id}
                            src={photo.url}
                            alt="Shot"
                            className="w-full aspect-[4/3] object-cover border-2 border-[#1D1D23]"
                          />
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Canvas render status badge */}
          <div className="mt-2 flex justify-center min-h-[16px]">
            {isRendering && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" /> Merender...
              </span>
            )}
              {hasAnyRendered && !isRendering && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" /> HD siap
                </span>
              )}
              {renderError && !isRendering && (
                <button
                  onClick={() => { hasRendered.current = false; renderAllToCanvas(); }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" /> Coba render ulang
                </button>
              )}
            </div>

          {/* Mini strip thumbnails for multi-print */}
          {hasMultiplePrints && (
            <div className="flex gap-2 overflow-x-auto w-full pb-1" style={{ scrollbarWidth: 'none' }}>
              {Array.from({ length: totalPrints }).map((_, i) => {
                const thumbSrc = canvasDataUrls[i] || serverStrips[i] || null;
                return (
                  <button
                    key={i}
                    onClick={() => setActivePrintTab(i)}
                    className={`shrink-0 w-16 border-2 rounded overflow-hidden transition-all ${
                      activePrintTab === i ? 'border-[#8A2BE2] shadow-[3px_3px_0px_#8A2BE2]' : 'border-slate-300'
                    }`}
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt={`Cetakan ${i + 1}`} className="w-full h-auto object-cover" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                        {i + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-4 w-full max-w-sm">

          {/* QR Code */}
          {qrDownloadUrl && (
            <div className="neobrutal-box bg-white p-5 border-4 border-slate-900 rounded-2xl shadow-[6px_6px_0px_#1D1D23] flex flex-col items-center gap-3 text-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Scan QR to Download on Mobile
              </h3>
              <div className="relative w-40 h-40 border-3 border-slate-900 bg-white flex items-center justify-center p-2 rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDownloadUrl)}`}
                  alt="Scan QR code"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                Download Photo Strip &amp; Raw Individual Shots
              </p>
            </div>
          )}

          {/* Render error warning */}
          {renderError && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 font-bold">
                {renderError}
              </p>
            </div>
          )}

          {session?.event ? (
            <Link
              href={`/event/${session.event.slug}`}
              className="neobrutal-button w-full py-5 bg-amber-400 text-[#1D1D23] hover:bg-amber-300 flex items-center justify-center gap-3 text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_#1D1D23]"
            >
              <Calendar className="w-6 h-6" strokeWidth={2.5} /> Kembali ke Event
            </Link>
          ) : (
            <>
              {/* Download all */}
              <button
                onClick={handleDownload}
                disabled={!isDownloadReady || isRendering}
                className="neobrutal-button w-full py-5 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRendering ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Merender HD...</>
                ) : (
                  <><Download className="w-6 h-6" /> {hasMultiplePrints ? `Download Semua (${totalPrints} Strip)` : hasAnyRendered ? 'Download Strip HD' : 'Download Photo'}</>
                )}
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="neobrutal-button w-full py-5 bg-[#3B82F6] text-white hover:bg-[#4f8ff7] flex items-center justify-center gap-3 text-lg"
              >
                <Share2 className="w-6 h-6" /> Share Result
              </button>

              <div className="my-4 border-t-2 border-dashed border-gray-300" />

              <Link
                href="/booth"
                className="neobrutal-button w-full py-4 bg-[#FF7F50] text-[#1D1D23] hover:bg-[#ff8e66] flex items-center justify-center gap-3"
              >
                <Camera className="w-5 h-5" /> Take Another One!
              </Link>

              <Link
                href="/"
                className="neobrutal-button w-full py-4 bg-gray-100 text-[#1D1D23] hover:bg-gray-200 flex items-center justify-center gap-3"
              >
                <Home className="w-5 h-5" /> Back to Home
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
