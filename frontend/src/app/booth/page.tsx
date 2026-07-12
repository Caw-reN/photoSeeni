'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Camera,
  FlipHorizontal,
  Clock,
  Layers,
  RefreshCw,
  CheckCircle,
  Loader2,
  X,
  ChevronUp,
  Frown,
  Images,
  Settings,
  Zap,
} from 'lucide-react';
import { framesApi, sessionsApi } from '@/lib/api';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { toast } from 'sonner';

type CapturedPhoto = {
  slot: number;
  url: string;
  blob?: Blob;
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

type Frame = {
  id: number;
  name: string;
  image_path?: string;
  image_url?: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
  : 'https://a035-160-22-192-46.ngrok-free.app';

const getImageUrl = (pathOrUrl: string | undefined) => {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

function BoothContent() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [totalSlots, setTotalSlots] = useState(4);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const panelDragControls = useDragControls();

  // ── Event mode (from redeem code) ──
  const searchParams = useSearchParams();
  const redeemCode = searchParams.get('redeem');
  const eventSessionId = searchParams.get('session');
  const isEventMode = !!redeemCode;
  const [eventInfo, setEventInfo] = useState<{ eventName?: string; packageName?: string; maxPhotos?: number; frameId?: number } | null>(null);

  // ── Hydrate photos from localStorage on mount ──
  useEffect(() => {
    try {
      const savedPhotos = localStorage.getItem('captured_photos');
      if (savedPhotos) {
        const parsedPhotos = JSON.parse(savedPhotos);
        if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
          setCapturedPhotos(parsedPhotos);
          setTotalSlots(parsedPhotos.length);
        }
      }
    } catch (err) {
      console.error('Failed to load photos from localStorage:', err);
    }
  }, []);

  // ── Single Audio Instance (mobile-compatible) ──
  const shutterAudioRef = useRef<HTMLAudioElement | null>(
    typeof window !== 'undefined' ? new Audio('/sounds/shutter.mp3') : null
  );

  // Set volume once on mount
  useEffect(() => {
    if (shutterAudioRef.current) {
      shutterAudioRef.current.volume = 0.7;
    }
  }, []);

  // ── Flash & Shutter Sound helpers ──
  const triggerFlash = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 180);
  }, []);

  const playShutterSound = useCallback(() => {
    if (shutterAudioRef.current) {
      shutterAudioRef.current.currentTime = 0;
      shutterAudioRef.current.play().catch((err) => console.log('Audio play blocked:', err));
    }
  }, []);

  const triggerCaptureEffects = useCallback(() => {
    triggerFlash();
    playShutterSound();
  }, [triggerFlash, playShutterSound]);

  // ── Camera Init ──
  const initCamera = useCallback(async (fMode: 'user' | 'environment', devId: string) => {
    if (typeof window === 'undefined') return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera (gunakan HTTPS)');
      setIsLoading(false);
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setCameraReady(false);
    console.log('[CAMERA INIT] Start initCamera');

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      };

      if (fMode) {
        videoConstraints.facingMode = fMode;
      }
      if (devId && !isMobile) {
        videoConstraints.deviceId = { exact: devId };
      }

      console.log('[CAMERA INIT] Constraints:', videoConstraints);
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT: 10 detik tidak ada respons')), 10000);
      });

      console.log('[CAMERA INIT] Waiting for getUserMedia...');
      const newStream = await Promise.race([getUserMediaPromise, timeoutPromise]);
      console.log('[CAMERA INIT] getUserMedia resolved');
      streamRef.current = newStream;

      if (videoRef.current) {
        console.log('[CAMERA INIT] Attaching stream to videoRef');
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch((e) => console.log('Play error:', e));
        setCameraReady(true);
        setIsLoading(false);
      } else {
        console.log('[CAMERA INIT] videoRef is null, waiting 500ms');
        setTimeout(() => {
          if (videoRef.current) {
            console.log('[CAMERA INIT] Attaching stream after timeout');
            videoRef.current.srcObject = newStream;
            videoRef.current.play().catch(() => {});
            setCameraReady(true);
          } else {
            console.log('[CAMERA INIT] videoRef still null!');
            setError('Video element not found');
          }
          setIsLoading(false);
        }, 500);
      }

      try {
        console.log('[CAMERA INIT] Enumerating devices');
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
        console.log('[CAMERA INIT] Enumeration done');
      } catch {}
    } catch (err: any) {
      console.error('[CAMERA INIT] Caught error:', err);
      const errName = err?.name ?? 'UnknownError';
      const errMsg = err?.message ?? '';
      let errorMessage = `Camera Error: ${errName}\n${errMsg}`;
      if (errName === 'NotAllowedError') errorMessage = 'Kamera ditolak. Buka Settings browser → izinkan Kamera → reload.';
      else if (errName === 'NotFoundError') errorMessage = 'Tidak ada kamera ditemukan di perangkat ini.';
      else if (errMsg.includes('TIMEOUT')) errorMessage = 'TIMEOUT: Browser tidak merespon setelah 10 detik.\n\nRefresh halaman atau restart browser.';
      setError(errorMessage);
      setIsLoading(false);
      toast.error('Gagal membuka kamera');
    }
  }, []);

  useEffect(() => {
    initCamera(facingMode, selectedDeviceId);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, selectedDeviceId]);

  useEffect(() => {
    const loadFrames = async () => {
      try {
        const data = await framesApi.list();
        setFrames(data.global ?? []);
      } catch {}
    };
    loadFrames();
  }, []);

  useEffect(() => {
    const createSession = async () => {
      try {
        // ── EVENT MODE: use pre-created session from redeem ──
        if (isEventMode && eventSessionId) {
          setSessionId(Number(eventSessionId));
          localStorage.setItem('active_session_id', eventSessionId);

          // Load event session info (set by /redeem page)
          const storedInfo = localStorage.getItem('event_session_info');
          if (storedInfo) {
            const info = JSON.parse(storedInfo);
            setEventInfo(info);
            if (info.maxPhotos) setTotalSlots(info.maxPhotos);
            if (info.sessionDuration) {
              const startTimeStr = localStorage.getItem('event_session_start_time');
              if (startTimeStr) {
                const elapsedSeconds = Math.floor((Date.now() - Number(startTimeStr)) / 1000);
                const remaining = Math.max(0, info.sessionDuration - elapsedSeconds);
                setSessionTimeRemaining(remaining);
              } else {
                setSessionTimeRemaining(info.sessionDuration);
              }
            }
          }

          // Clear any old photos
          localStorage.removeItem('captured_photos');
          localStorage.removeItem('arranged_slots');
          setCapturedPhotos([]);
          setCurrentSlot(0);
          setRetakeIndex(null);
          return;
        }

        // ── NORMAL MODE ──
        const storedFrame = localStorage.getItem('selected_frame');
        let frameId: number | undefined;
        if (storedFrame) {
          const parsed = JSON.parse(storedFrame);
          setSelectedFrame(parsed);
          frameId = parsed?.id;
        }
        const session = await sessionsApi.create(frameId);
        setSessionId(session.id);
        localStorage.setItem('active_session_id', session.id.toString());
        
        // Clear cached photos and slots since we started a brand new session
        localStorage.removeItem('captured_photos');
        localStorage.removeItem('arranged_slots');
        setCapturedPhotos([]);
        setCurrentSlot(0);
        setRetakeIndex(null);
      } catch (err) {
        console.error('Gagal membuat sesi baru:', err);
        toast.error('Gagal membuat sesi baru di server. Hubungi admin.');
      }
    };
    createSession();
  }, [isEventMode, eventSessionId]);

  // ── Global Session Countdown Timer ──
  useEffect(() => {
    if (sessionTimeRemaining === null) return;
    
    if (sessionTimeRemaining <= 0) {
      const handleTimeout = async () => {
        toast.error('Waktu sesi Anda telah habis!');
        if (capturedPhotos.length > 0) {
          try {
            localStorage.setItem('captured_photos', JSON.stringify(
              capturedPhotos.map((p) => ({ slot: p.slot, url: p.url }))
            ));
          } catch (err) {
            console.warn('Storage penuh, tidak bisa menyimpan cache foto:', err);
          }
          
          // Stop camera stream tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          
          router.push('/select-frame');
        } else {
          toast.error('Waktu habis sebelum foto diambil.');
          // Stop camera stream tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          router.push('/');
        }
      };
      handleTimeout();
      return;
    }

    const timer = setTimeout(() => {
      setSessionTimeRemaining(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessionTimeRemaining, capturedPhotos, router]);

  // ── Capture Logic ──
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    triggerCaptureEffects();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const url = await blobToBase64(blob);
      setCapturedPhotos((prev) => {
        const filtered = prev.filter((p) => p.slot !== currentSlot);
        const updated = [...filtered, { slot: currentSlot, url, blob }];
        try {
          localStorage.setItem('captured_photos', JSON.stringify(
            updated.map((p) => ({ slot: p.slot, url: p.url }))
          ));
        } catch (error) {
          console.warn('Storage penuh, tidak bisa menyimpan cache foto:', error);
        }
        return updated;
      });
      if (sessionId) {
        setIsUploading(true);
        try {
          await sessionsApi.uploadPhoto(sessionId, currentSlot, blob);
        } catch (error) {
          console.error("Gagal mengunggah foto:", error);
          toast.error("Gagal mengunggah foto ke server. Sesi akan disinkronkan saat checkout.");
        }
        setIsUploading(false);
      }
      if (currentSlot < totalSlots - 1) setCurrentSlot((s) => s + 1);
    }, 'image/jpeg', 0.5);
  }, [facingMode, currentSlot, sessionId, totalSlots, triggerCaptureEffects]);

  const capturePhotoAtSlot = useCallback(
    async (slot: number): Promise<void> => {
      return new Promise((resolve) => {
        if (!videoRef.current || !canvasRef.current) { resolve(); return; }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(); return; }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        triggerCaptureEffects();
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }
          const url = await blobToBase64(blob);
          setCapturedPhotos((prev) => {
            const filtered = prev.filter((p) => p.slot !== slot);
            const updated = [...filtered, { slot, url, blob }];
            try {
              localStorage.setItem('captured_photos', JSON.stringify(
                updated.map((p) => ({ slot: p.slot, url: p.url }))
              ));
            } catch (error) {
              console.warn('Storage penuh, tidak bisa menyimpan cache foto:', error);
            }
            return updated;
          });
          if (sessionId) {
            setIsUploading(true);
            try {
              await sessionsApi.uploadPhoto(sessionId, slot, blob);
            } catch (error) {
              console.error("Gagal mengunggah foto:", error);
              toast.error("Gagal mengunggah foto ke server. Sesi akan disinkronkan saat checkout.");
            }
            setIsUploading(false);
          }
          resolve();
        }, 'image/jpeg', 0.5);
      });
    },
    [facingMode, sessionId]
  );

  const capturePhotoSequence = useCallback(async () => {
    setIsAutoCapturing(true);
    setIsPanelOpen(false);
    await new Promise((res) => setTimeout(res, 250));
    for (let slot = 0; slot < totalSlots; slot++) {
      if (timerSeconds > 0) {
        setCountdown(timerSeconds);
        for (let i = timerSeconds - 1; i >= 0; i--) {
          await new Promise((res) => setTimeout(res, 1000));
          setCountdown(i);
        }
        setCountdown(null);
      }
      await capturePhotoAtSlot(slot);
      if (slot < totalSlots - 1) await new Promise((res) => setTimeout(res, 500));
    }
    setIsAutoCapturing(false);
  }, [timerSeconds, totalSlots, capturePhotoAtSlot]);

  const triggerShutter = useCallback(async () => {
    // ── RETAKE PATH: single-shot at the targeted slot ──
    if (retakeIndex !== null) {
      setIsPanelOpen(false);
      setIsAutoCapturing(true);
      await new Promise((res) => setTimeout(res, 250));
      if (timerSeconds > 0) {
        setCountdown(timerSeconds);
        for (let i = timerSeconds - 1; i >= 0; i--) {
          await new Promise((res) => setTimeout(res, 1000));
          setCountdown(i);
        }
        setCountdown(null);
      }
      await capturePhotoAtSlot(retakeIndex);
      setRetakeIndex(null);
      setIsAutoCapturing(false);
      return;
    }

    // ── NORMAL PATH ──
    if (isAutoMode) {
      await capturePhotoSequence();
    } else {
      setIsPanelOpen(false);
      await new Promise((res) => setTimeout(res, 250));
      if (timerSeconds > 0) {
        setCountdown(timerSeconds);
        for (let i = timerSeconds - 1; i >= 0; i--) {
          await new Promise((res) => setTimeout(res, 1000));
          setCountdown(i);
        }
        setCountdown(null);
      }
      await capturePhoto();
    }
  }, [isAutoMode, timerSeconds, capturePhoto, capturePhotoSequence, retakeIndex, capturePhotoAtSlot]);

  const retakeSlot = (slot: number) => {
    setCapturedPhotos((prev) => {
      const updated = prev.filter((p) => p.slot !== slot);
      try {
        localStorage.setItem('captured_photos', JSON.stringify(
          updated.map((p) => ({ slot: p.slot, url: p.url }))
        ));
      } catch (error) {
        console.warn('Storage penuh, tidak bisa menyimpan cache foto:', error);
      }
      return updated;
    });
    setCurrentSlot(slot);
    setRetakeIndex(slot);
  };

   const handleComplete = async () => {
     if (capturedPhotos.length > 0) {
       try {
         // Photos are already in base64 format — just persist to localStorage
         localStorage.setItem('captured_photos', JSON.stringify(
           capturedPhotos.map((p) => ({ slot: p.slot, url: p.url }))
         ));
       } catch (err) {
         console.warn('Storage penuh, tidak bisa menyimpan cache foto:', err);
       }

        // We no longer call complete session in the background here,
        // it will be completed after payment on the checkout page.

       // Immediate navigation
       router.push('/select-frame');
     } else {
       toast.error('Ambil foto terlebih dahulu, brok!');
     }
   };

  const handleResetSession = () => {
    try {
      localStorage.removeItem('captured_photos');
    } catch (err) {
      console.warn('Gagal menghapus cache foto:', err);
    }
    setCapturedPhotos([]);
    setCurrentSlot(0);
    setRetakeIndex(null);
  };

  const allSlotsFilled = capturedPhotos.length >= totalSlots;
  const isReviewing =
    retakeIndex === null &&
    ((!isAutoMode && capturedPhotos.length > 0) ||
      (isAutoMode && capturedPhotos.length === totalSlots));

  const handleExitConfirm = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    router.push('/');
  };

  // ── Error State ──
  if (error && !cameraReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 bg-[#1D1D23]">
        <div className="w-full max-w-md bg-red-50 border-2 border-red-400 rounded-2xl shadow-[4px_4px_0px_rgba(239,68,68,0.5)] p-6 flex flex-col gap-4">
          <h2 className="text-red-600 font-extrabold text-lg flex items-center gap-2">
            <X className="w-5 h-5 text-red-600" strokeWidth={3} />
            Kamera Gagal Dibuka
          </h2>
          <pre className="text-red-800 text-xs font-mono whitespace-pre-wrap break-words bg-red-100 border border-red-200 rounded-lg p-3">{error}</pre>
          <button
            className="w-full py-3 rounded-xl bg-red-500 text-white font-extrabold border-2 border-red-700 shadow-[3px_3px_0px_rgba(185,28,28,1)] hover:bg-red-600 transition-colors"
            onClick={() => { setError(null); setIsLoading(true); initCamera(facingMode, selectedDeviceId); }}
          >
            <RefreshCw className="w-4 h-4 inline-block mr-1" /> Coba Lagi
          </button>
          <button className="w-full py-2 rounded-xl bg-white text-gray-600 font-bold border border-gray-300 hover:bg-gray-100 transition-colors text-sm" onClick={() => router.push('/')}>
            ← Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ═══ Camera Flash Overlay ═══ */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            key="flash-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08, ease: 'easeOut' }}
            className="fixed inset-0 z-[200] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ═══ Tombol Close (Fixed Top-Left) ═══ */}
      <button
        onClick={() => setShowExitModal(true)}
        className="fixed top-4 left-4 z-[60] w-11 h-11 flex items-center justify-center rounded-full bg-white border-2 border-[#1D1D23] shadow-[3px_3px_0px_#1D1D23] hover:bg-red-100 hover:border-red-400 transition-all active:scale-95"
        title="Keluar"
      >
        <X className="w-5 h-5 text-[#1D1D23]" strokeWidth={3} />
      </button>

      {/* ═══ Global Session Timer (Fixed Top-Right) ═══ */}
      {sessionTimeRemaining !== null && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-2 border-2 border-[#1D1D23] rounded-full font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-[3px_3px_0px_#1D1D23] transition-all ${
          sessionTimeRemaining < 30
            ? 'bg-rose-500 text-white animate-pulse'
            : 'bg-amber-400 text-[#1D1D23]'
        }`}>
          <Clock className={`w-4 h-4 ${sessionTimeRemaining < 30 ? 'animate-spin' : ''}`} />
          <span>
            {Math.floor(sessionTimeRemaining / 60).toString().padStart(2, '0')}:
            {(sessionTimeRemaining % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}

      {/* ═══ Exit Modal ═══ */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-[#FFFDF7] border-3 border-[#1D1D23] rounded-3xl shadow-[6px_6px_0px_#1D1D23] p-8 max-w-md w-full flex flex-col items-center gap-6" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
              <div className="w-20 h-20 rounded-full bg-amber-100 border-3 border-[#1D1D23] flex items-center justify-center">
                <Frown className="w-10 h-10 text-amber-500" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-[#1D1D23] mb-2">Yakin mau keluar?</h2>
                <p className="text-gray-500 font-semibold">Foto-foto di sesi ini akan hilang.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowExitModal(false)} className="flex-1 py-3.5 rounded-2xl bg-[#8A2BE2] text-white font-extrabold border-2 border-[#1D1D23] shadow-[3px_3px_0px_#1D1D23]">Lanjut Foto</button>
                <button onClick={handleExitConfirm} className="flex-1 py-3.5 rounded-2xl bg-white text-red-500 font-extrabold border-2 border-red-400 shadow-[3px_3px_0px_#e57373]">Keluar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
           MAIN LAYOUT: Kamera (Kiri/Tengah) + Photo Review Sidebar (Kanan)
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="w-full min-h-screen md:h-screen md:w-screen md:overflow-hidden flex flex-col md:flex-row bg-[#1D1D23]">

        {/* ─── KIRI/TENGAH: Canvas Kamera ─── */}
        <div className={`w-full ${!isReviewing ? 'h-[100dvh]' : 'h-[50vh]'} md:flex-1 md:h-full flex flex-col justify-center items-center relative p-4`}>
          <div className="relative w-full h-full flex items-center justify-center bg-white overflow-hidden rounded-3xl border-4 border-slate-800 shadow-[6px_6px_0px_0px_rgba(30,41,59,1)]">

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900 rounded-3xl gap-4">
                <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin" />
                <p className="text-white font-bold text-sm">Membuka kamera...</p>
              </div>
            )}

            {/* Video Feed */}
            <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover bg-white ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />

            {/* Countdown Overlay */}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <span className="text-[120px] font-extrabold text-white drop-shadow-2xl animate-ping">{countdown}</span>
              </div>
            )}



            {/* Upload Indicator */}
            {isUploading && (
              <div className="absolute bottom-4 right-4 z-20 bg-black/70 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </div>
            )}

            {/* Progress Bar Slots */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2 w-[90%] md:w-[80%] justify-center z-20">
              {Array.from({ length: totalSlots }).map((_, i) => (
                <div key={i} className={`flex-1 h-3 rounded-full border-2 border-[#8A2BE2] transition-all ${i < capturedPhotos.length ? 'bg-[#8A2BE2]' : i === currentSlot ? 'bg-amber-400 animate-pulse' : 'bg-black/50'}`} />
              ))}
            </div>

            {/* Shot Counter */}
            <div className="absolute top-14 left-1/2 -translate-x-1/2 text-white/90 text-sm font-bold uppercase tracking-widest z-20">
              {allSlotsFilled ? 'All shots taken!' : `Shot ${currentSlot + 1} of ${totalSlots}`}
            </div>

            {/* ═══ Shutter + Controls — floating inside camera frame ═══ */}
            {!isAutoCapturing && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center gap-3">
                {/* Shutter Button */}
                <button
                  onClick={triggerShutter}
                  disabled={!cameraReady || isAutoCapturing}
                  className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                    !cameraReady || isAutoCapturing
                      ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                      : 'bg-orange-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[3px] active:translate-y-[3px]'
                  }`}
                >
                  <Camera className="w-8 h-8" strokeWidth={2.5} />
                </button>

                {/* Controls Button */}
                <AnimatePresence>
                  {!isPanelOpen && (
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); setIsPanelOpen(true); }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF7F50] to-[#FFB347] text-white font-extrabold text-sm border-2 border-white shadow-lg active:scale-95 transition-transform"
                    >
                      <ChevronUp className="w-4 h-4" />
                      Controls
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* ─── KANAN: Photo Review Sidebar (hanya muncul jika ada foto) ─── */}
        <AnimatePresence>
          {isReviewing && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`w-full md:w-[350px] ${!isReviewing ? 'hidden' : 'flex'} md:flex flex-col justify-between h-auto md:h-full border-t-2 md:border-t-0 md:border-l-4 border-slate-800 bg-[#FFFDF7] overflow-hidden`}
            >
              <div className="p-4 border-b-2 border-slate-800 shrink-0">
                <h3 className="font-extrabold text-[#1D1D23] text-lg">Review Foto</h3>
              </div>

              <div className="w-full overflow-visible md:overflow-y-auto p-4 flex flex-col gap-4">
                {Array.from({ length: totalSlots }).map((_, i) => {
                  const photo = capturedPhotos.find((p) => p.slot === i);
                  return (
                    <div key={i} className="bg-white border-2 border-slate-800 rounded-2xl shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] overflow-hidden shrink-0">
                      <div className="px-3 py-2 border-b-2 border-slate-800 bg-slate-50 flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 text-sm">SHOT {i + 1}</span>
                        {photo && (
                          <button
                            onClick={() => retakeSlot(i)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Ulang
                          </button>
                        )}
                      </div>
                      <div className="aspect-video bg-slate-100 relative overflow-hidden">
                        {photo ? (
                          <img src={photo.url} alt={`Shot ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-slate-300 font-bold text-sm">Belum diambil</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tombol Selesai & Reset */}
              {allSlotsFilled && (
                <div className="p-4 border-t-2 border-slate-800 shrink-0 bg-white flex flex-col gap-3">
                  <button
                    onClick={handleComplete}
                    className="w-full py-4 rounded-2xl bg-[#8A2BE2] border-2 border-[#1D1D23] text-white font-extrabold text-lg shadow-[4px_4px_0px_#1D1D23] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1D1D23] active:translate-y-0 active:shadow-[2px_2px_0px_#1D1D23] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-6 h-6" /> Selesai & Lihat Hasil
                  </button>
                  <button
                    onClick={handleResetSession}
                    className="w-full py-3 rounded-xl bg-white border-2 border-red-400 text-red-500 font-extrabold text-sm shadow-[3px_3px_0px_rgba(239,68,68,0.5)] hover:bg-red-50 active:translate-y-1 active:shadow-[1px_1px_0px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Hapus & Ulangi Sesi
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           BOTTOM SHEET: Control Panel (melayang fixed di bawah layar)
           ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Backdrop gelap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
            />

            {/* Panel itu sendiri */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag="y"
              dragControls={panelDragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 20) {
                  setIsPanelOpen(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-[100] max-h-[80vh] overflow-y-auto bg-[#FFFDF7] rounded-t-3xl border-t-4 border-x-4 border-slate-800 shadow-[0px_-6px_0px_0px_rgba(30,41,59,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Pill — hanya area ini yang memulai gesture drag */}
              <div
                className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => panelDragControls.start(e)}
                onClick={() => setIsPanelOpen(false)}
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-300" />
              </div>

              <div className="px-6 pb-6 pt-2">
                <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">

                  {/* Header */}
                  <h2 className="font-black text-[#1D1D23] text-xl tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" strokeWidth={2.5} />
                    Pengaturan
                  </h2>

                  {/* ── Card Grid: 1 kolom di mobile, 2x2 di desktop ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* ── 1. Pilih Kamera (Select Dropdown) ── */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                      <div className="flex items-center gap-2 mb-3">
                        <Camera className="w-4 h-4 text-indigo-600" strokeWidth={2.5} />
                        <span className="font-bold text-slate-800 text-sm">Kamera Default</span>
                      </div>
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-xl font-bold text-slate-800 outline-none focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Kamera Default</option>
                        {videoDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ── 2. Mode Toggle (Switch) ── */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                      <label className="flex items-center justify-between cursor-pointer h-full">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-indigo-600" strokeWidth={2.5} />
                          Berurutan Otomatis
                        </span>
                        <button
                          onClick={() => setIsAutoMode(!isAutoMode)}
                          className={`relative w-14 h-8 rounded-full border-2 border-slate-900 transition-all ${isAutoMode ? 'bg-[#8A2BE2]' : 'bg-slate-100'} shadow-[2px_2px_0px_rgba(15,23,42,1)]`}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 bg-white border-2 border-slate-900 rounded-full transition-all duration-200 ${isAutoMode ? 'right-0.5' : 'left-0.5'} shadow-[1px_1px_0px_rgba(15,23,42,1)]`} />
                        </button>
                      </label>
                    </div>

                    {/* ── 3. Timer Card ── */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                      <div className="flex justify-between items-center w-full mb-2">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4 text-indigo-600" strokeWidth={2.5} />
                          Timer
                        </span>
                        <span className="text-xl font-extrabold text-indigo-600">{timerSeconds}s</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        value={timerSeconds}
                        onChange={(e) => setTimerSeconds(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    {/* ── 4. Jumlah Foto Card ── */}
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                      <div className="flex justify-between items-center w-full mb-2">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-600" strokeWidth={2.5} />
                          Jumlah Foto
                        </span>
                        <span className="text-xl font-extrabold text-indigo-600">{totalSlots} Photos</span>
                      </div>
                      {!isEventMode ? (
                        <input
                          type="range"
                          min="3"
                          max="10"
                          value={totalSlots}
                          onChange={(e) => setTotalSlots(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                        />
                      ) : (
                        <p className="text-xs font-semibold text-slate-400 mt-1 italic">Terkunci sesuai paket event</p>
                      )}
                    </div>

                  </div>

                  {/* ── 4. Action Area: Flip Kamera ── */}
                  <div className="flex items-center justify-center gap-4 pt-2 pb-2">
                    <button
                      onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
                      className="flex-shrink-0 w-14 h-14 rounded-full bg-white border-2 border-slate-900 flex items-center justify-center shadow-[3px_3px_0px_rgba(15,23,42,1)] hover:bg-slate-50 active:translate-y-1 active:shadow-[1px_1px_0px_rgba(15,23,42,1)] transition-all"
                    >
                      <FlipHorizontal className="w-6 h-6 text-slate-800" strokeWidth={2.5} />
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function BoothPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#8A2BE2]" /></div>}>
      <BoothContent />
    </Suspense>
  );
}
