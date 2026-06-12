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
} from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
  : 'https://e942-103-224-73-153.ngrok-free.app';

const getImageUrl = (pathOrUrl: string | undefined) => {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

const proxyImageUrl = (url: string): string => {
  if (!url) return '';
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
};

type SlotData = {
  photoUrl: string;
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
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
  const [slotsData, setSlotsData] = useState<SlotData[]>([]);
  const [frameImageUrl, setFrameImageUrl] = useState<string | null>(null);
  const [frameId, setFrameId] = useState<number | null>(null);
  const [slotOrientations, setSlotOrientations] = useState<Record<number, 'landscape' | 'portrait'>>({});

  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const frameImgRef = useRef<HTMLImageElement>(null);
  const hasRendered = useRef(false);

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
          let saved: SlotData[] | null = null;
          try {
            const stored = localStorage.getItem('arranged_slots');
            if (stored) saved = JSON.parse(stored);
          } catch (_) {}

          const built: SlotData[] = coords.map((_, i) => ({
            photoUrl: sortedPhotos[i]?.url ? proxyImageUrl(sortedPhotos[i].url) : '',
            scale: saved?.[i]?.scale ?? 1,
            rotate: saved?.[i]?.rotate ?? 0,
            translateX: saved?.[i]?.translateX ?? 0,
            translateY: saved?.[i]?.translateY ?? 0,
          }));
          setSlotsData(built);
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

  // ── Canvas render (identical logic to checkout's renderStripBlob) ──────────
  const renderToCanvas = useCallback(async () => {
    if (hasRendered.current) return;
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

      // scaleRatio: same formula as checkout
      const screenFrameWidth = frameEl.clientWidth || 300;
      const scaleRatio = canvas.width / screenFrameWidth;

      // Draw photos into slots
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

      // Draw frame overlay on top via proxy
      const frameSrc = frameId
        ? proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${frameId}/image`)
        : proxyImageUrl(frameEl.src);
      const frameOverlay = await loadImageFromUrl(frameSrc);
      if (frameOverlay.src.startsWith('blob:')) objectUrls.push(frameOverlay.src);

      ctx.drawImage(frameOverlay, 0, 0, canvas.width, canvas.height);
      setCanvasDataUrl(canvas.toDataURL('image/jpeg', 0.95));
    } catch (err: any) {
      console.error('Canvas render error:', err);
      setRenderError(err?.message || 'Gagal merender strip.');
      hasRendered.current = false;
    } finally {
      objectUrls.forEach(u => URL.revokeObjectURL(u));
      setIsRendering(false);
    }
  }, [coordinates, slotsData, frameId, loadImageFromUrl]);

  const handleFrameLoad = useCallback(() => {
    renderToCanvas();
  }, [renderToCanvas]);

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const src = canvasDataUrl || session?.final_image_url;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `snapjoy-${session?.id || 'strip'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My SnapJoy Photo Strip!',
          text: 'Lihat foto booth saya dari SnapJoy!',
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

  const canShowLayered = frameImageUrl && coordinates.length > 0 && slotsData.length > 0;
  const qrDownloadUrl = typeof window !== 'undefined'
    ? window.location.origin + '/download/' + sessionId
    : '';

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
        <p className="text-xl text-gray-600 mt-2 font-bold">Your photo strip is ready!</p>
      </div>

      <div className="flex flex-col md:flex-row gap-12 items-center md:items-start max-w-5xl w-full justify-center">

        {/* ── Photo Strip — neobrutal tilted box (original layout) ── */}
        <div className="neobrutal-box bg-white p-4 shadow-[12px_12px_0px_#1D1D23] transform -rotate-2 hover:rotate-0 transition-transform duration-300 w-full max-w-xs flex-shrink-0">
          {canShowLayered ? (
            // Layered: foto di slot + frame PNG overlay — sama persis seperti checkout
            <div className="relative inline-block overflow-hidden w-full">
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
                        alt={`Photo Slot ${index + 1}`}
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
              {/* Frame PNG — ref ini dipakai canvas renderer untuk mengukur clientWidth (scaleRatio) */}
              <img
                ref={frameImgRef}
                src={frameImageUrl!}
                alt="Frame Overlay"
                onLoad={handleFrameLoad}
                className="w-full h-auto block relative z-10 pointer-events-none"
              />
            </div>
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

          {/* Canvas render status badge */}
          <div className="mt-2 flex justify-center min-h-[16px]">
            {isRendering && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" /> Merender...
              </span>
            )}
            {canvasDataUrl && !isRendering && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" /> HD siap
              </span>
            )}
            {renderError && !isRendering && (
              <button
                onClick={() => { hasRendered.current = false; renderToCanvas(); }}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Coba render ulang
              </button>
            )}
          </div>
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

          {/* Download — pakai canvas jika berhasil, fallback ke server */}
          <button
            onClick={handleDownload}
            disabled={(!canvasDataUrl && !session.final_image_url) || isRendering}
            className="neobrutal-button w-full py-5 bg-[#8A2BE2] text-white hover:bg-[#9b42ef] flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRendering ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Merender HD...</>
            ) : (
              <><Download className="w-6 h-6" /> {canvasDataUrl ? 'Download Strip HD' : 'Download Photo'}</>
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
        </div>
      </div>
    </div>
  );
}
