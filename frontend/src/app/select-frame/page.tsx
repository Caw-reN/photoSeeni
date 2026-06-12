'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type Slot = {
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
  slots?: Slot[];
  coordinates?: string | Slot[];
  description?: string;
};

const BACKEND_URL = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/api\/?$/, '');
  }
  return 'https://e942-103-224-73-153.ngrok-free.app';
})();

// Wrap image URLs through Next.js proxy to add ngrok bypass header
// (browser <img> tags cannot send custom headers directly)
const proxyImageUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  return `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
};

const getFrameImageUrl = (frame: Frame): string => {
  // Build the direct backend URL first, then proxy it
  let directUrl = '';
  if (frame.id) {
    directUrl = `${BACKEND_URL}/api/frame-templates/${frame.id}/image`;
  } else if (frame.image_url && frame.image_url.startsWith('http')) {
    directUrl = frame.image_url;
  } else {
    const path = frame.image_url || frame.image_path;
    if (!path) return '';
    directUrl = path.startsWith('http') ? path : `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  return proxyImageUrl(directUrl);
};


const getParsedCoordinates = (frame: Frame | null): Slot[] => {
  if (!frame) return [];

  // Try coordinates first (as JSON string or already parsed)
  if (frame.coordinates) {
    try {
      const parsed =
        typeof frame.coordinates === 'string'
          ? JSON.parse(frame.coordinates)
          : frame.coordinates;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse coordinates:', e);
    }
  }

  // Fallback to slots
  if (frame.slots && Array.isArray(frame.slots)) {
    return frame.slots;
  }

  return [];
};

export default function SelectFramePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load frames on mount
  useEffect(() => {
    if (!isMounted) return;

    const loadFrames = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;
        const res = await fetch(`${apiUrl}/frames`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
          }
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Handle response - expect direct array from backend
        let framesList: Frame[] = [];
        
        if (Array.isArray(data)) {
          framesList = data;
        } else if (data && typeof data === 'object') {
          // Fallback: check for {global: [], custom: []} format
          if (data.global || data.custom) {
            framesList = [
              ...(Array.isArray(data.global) ? data.global : []),
              ...(Array.isArray(data.custom) ? data.custom : [])
            ];
          } else if (data.data && Array.isArray(data.data)) {
            framesList = data.data;
          } else {
            throw new Error('Invalid response format from API');
          }
        }

        setFrames(framesList);
        if (framesList.length > 0) {
          setSelectedFrame(framesList[0]);
        }
      } catch (error: any) {
        const errorMsg = error?.message || 'Gagal memuat frame template';
        console.error('Frame loading error:', error);
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadFrames();
  }, [isMounted]);

  const handleFrameSelect = (frame: Frame) => {
    setSelectedFrame(frame);
  };

  const handleProceed = async () => {
    if (!selectedFrame) {
      toast.error('Pilih frame terlebih dahulu');
      return;
    }
    setIsNavigating(true);
    try {
      localStorage.setItem('selected_frame', JSON.stringify(selectedFrame));
      router.push('/edit-photo');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pilihan frame');
      setIsNavigating(false);
    }
  };

  // Prevent hydration mismatch - don't render anything on server
  if (!isMounted) {
    return <div className="h-screen w-screen bg-slate-900" />;
  }

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1D1D23]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin" />
          <p className="text-white font-bold text-lg">Memuat frame template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#1D1D23] flex flex-col md:flex-row overflow-hidden">
      {/* ═══ KIRI: Grid Daftar Frame ═══ */}
      <div className="flex-1 flex flex-col p-4 md:p-6 h-full overflow-hidden">
        <div className="flex items-center gap-4 mb-4 shrink-0">
          <button
            onClick={() => router.push('/booth')}
            className="bg-white text-slate-900 border-4 border-slate-900 p-2.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            title="Kembali ke Booth"
          >
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Pilih Frame</h1>
        </div>

        {/* Error Box */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border-4 border-red-600 rounded-xl shadow-[3px_3px_0px_0px_rgba(220,38,38,1)] shrink-0">
            <div className="flex items-start gap-3">
              <X className="w-6 h-6 text-red-600 shrink-0 mt-0.5" strokeWidth={3} />
              <div>
                <p className="font-black text-red-800 text-sm">Load Error</p>
                <p className="text-red-700 text-xs font-semibold mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Frame Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {frames.length > 0 ? (
              frames.map((frame) => (
                <div
                  key={frame.id}
                  onClick={() => handleFrameSelect(frame)}
                  className={`bg-white border-4 p-2 rounded-2xl transition-all cursor-pointer flex flex-col ${
                    selectedFrame?.id === frame.id
                      ? 'border-indigo-600 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] translate-x-[2px] translate-y-[2px]'
                      : 'border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
                  }`}
                >
                  {/* Frame Thumbnail — aspect ratio natural sesuai gambar frame */}
                  <div className="w-full rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100">
                    <img
                      src={getFrameImageUrl(frame)}
                      alt={frame.name || 'Frame'}
                      className="w-full h-auto object-contain rounded-xl block"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22120%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23e2e8f0%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2212%22 fill=%22%2394a3b8%22>No Image</text></svg>';
                      }}
                    />
                  </div>

                  {/* Label Bottom */}
                  <div className="mt-2 pt-2 border-t-2 border-slate-900 flex justify-between items-center shrink-0">
                    <span className="font-black text-slate-900 text-xs md:text-sm uppercase truncate pr-2">
                      {frame.name}
                    </span>
                    {selectedFrame?.id === frame.id && (
                      <span className="bg-indigo-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full border-2 border-slate-900 shrink-0">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-64 gap-4">
                <X className="w-12 h-12 text-slate-500" strokeWidth={1} />
                <p className="text-slate-400 font-bold text-center">
                  Tidak ada frame template tersedia
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ MOBILE ONLY: Tombol Lanjutkan di bawah grid ═══ */}
        <div className="md:hidden shrink-0 pt-3 pb-2">
          {selectedFrame ? (
            <button
              onClick={handleProceed}
              disabled={isNavigating}
              className="w-full py-4 rounded-2xl font-extrabold text-base border-4 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] active:translate-y-1 active:shadow-[1px_1px_0px_0px_rgba(30,41,59,1)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  LANJUTKAN KE EDIT FOTO
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-extrabold text-base border-4 bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2"
            >
              Pilih frame dulu
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ KANAN: Detail Preview (STICKY, NO SCROLL) ═══ */}
      <div className="hidden md:flex md:w-[450px] h-full flex-col bg-[#FFFDF7] border-l-4 border-slate-800 p-6 gap-4 overflow-hidden">
        {/* Header */}
        <div className="shrink-0">
          <h3 className="font-black text-[#1D1D23] text-xl tracking-tight mb-1">
            Preview
          </h3>
          {selectedFrame && (
            <p className="text-slate-700 font-bold text-sm">{selectedFrame.name}</p>
          )}
        </div>

        {/* Frame Preview Container — NO overflow-y-auto, strictly overflow-hidden */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-slate-50 border-4 border-slate-800 rounded-2xl shadow-[6px_6px_0px_0px_rgba(30,41,59,1)]">
          {selectedFrame ? (
            <div className="relative inline-block max-h-[65vh]">
              <img
                src={getFrameImageUrl(selectedFrame)}
                alt={selectedFrame.name || 'Frame'}
                className="max-h-[65vh] w-auto object-contain rounded-xl border-4 border-slate-900"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23e2e8f0%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22 fill=%22%2394a3b8%22>Gagal memuat</text></svg>';
                }}
              />

              {/* Slots Overlay — menempel presisi pada gambar */}
              {getParsedCoordinates(selectedFrame).map((slot, index) => (
                <div
                  key={slot.id || index}
                  style={{
                    position: 'absolute',
                    left: `${slot.x_percent ?? slot.x ?? 0}%`,
                    top: `${slot.y_percent ?? slot.y ?? 0}%`,
                    width: `${slot.width_percent ?? slot.width ?? 0}%`,
                    height: `${slot.height_percent ?? slot.height ?? 0}%`,
                  }}
                  className="border-4 border-dashed border-indigo-600 bg-indigo-500/20 flex items-center justify-center rounded-lg"
                >
                  <span className="bg-indigo-600 text-white text-[10px] md:text-xs font-black px-2 py-1 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    SLOT {slot.order ?? index + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <p className="text-slate-400 font-bold text-center">
                Pilih frame untuk preview
              </p>
            </div>
          )}
        </div>

        {/* Description (if available) */}
        {selectedFrame?.description && (
          <div className="shrink-0 bg-white border-2 border-slate-800 rounded-xl p-3">
            <p className="text-slate-700 font-semibold text-xs">
              {selectedFrame.description}
            </p>
          </div>
        )}

        {/* Action Button */}
        {selectedFrame ? (
          <button
            onClick={handleProceed}
            disabled={isNavigating}
            className="shrink-0 w-full py-4 rounded-2xl font-extrabold text-lg border-4 border-[#1D1D23] bg-[#8A2BE2] text-white shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isNavigating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                LANJUTKAN KE EDIT FOTO
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <button
            disabled
            className="shrink-0 w-full py-4 rounded-2xl font-extrabold text-lg border-4 bg-slate-300 border-slate-400 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2"
          >
            LANJUTKAN KE EDIT FOTO
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mobile bottom sheet dihapus — tombol lanjutkan sudah ada di dalam grid panel */}
    </div>
  );
}
