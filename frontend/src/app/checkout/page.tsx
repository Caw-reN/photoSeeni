'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, QrCode, Wallet, ShieldCheck, Loader2, CheckCircle2, Copy, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { sessionsApi, settingsApi } from '@/lib/api';

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
  if (apiUrl && !apiUrl.startsWith('/')) return (apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl);
  return '';
})();

const getImageUrl = (pathOrUrl: string | undefined) => {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

const proxyImageUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/')) return targetUrl; // relative — Next.js rewrite handles it
  return `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
};

const getFrameImageUrl = (frame: Frame | null): string => {
  if (!frame) return '';
  if (frame.id) return proxyImageUrl(`${BACKEND_URL}/api/frame-templates/${frame.id}/image`);
  return proxyImageUrl(getImageUrl(frame.image_url || frame.image_path));
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
  if (frame.slots && Array.isArray(frame.slots)) {
    return frame.slots;
  }
  return [];
};

export default function CheckoutPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [slotsDataList, setSlotsDataList] = useState<SlotData[][]>([]);
  const [coordinates, setCoordinates] = useState<SlotCoordinate[]>([]);
  const [sessionId, setSessionId] = useState<string | number | null>(null);
  const [slotOrientations, setSlotOrientations] = useState<Record<number, 'landscape' | 'portrait'>>({});
  
  // Checkout States
  const [paymentMethod] = useState<'qris'>('qris');
  
  // Paymenku States
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentQrString, setPaymentQrString] = useState<string | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  
  // Payment Process States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success'>('details');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes

  // Pricing States
  const [price, setPrice] = useState(25000);
  const [adminFee, setAdminFee] = useState(1500);
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const totalPayment = price + adminFee;

  // Event mode: session already paid via redeem code
  const [isEventSession, setIsEventSession] = useState(false);
  const [eventRedeemCode, setEventRedeemCode] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Detect event mode
    const storedRedeemCode = localStorage.getItem('event_redeem_code');
    if (storedRedeemCode) {
      setIsEventSession(true);
      setEventRedeemCode(storedRedeemCode);
    }
    // Fetch dynamic pricing and payment toggle
    settingsApi.getPublic().then((res) => {
      if (res.session_price !== undefined) setPrice(res.session_price);
      if (res.service_fee !== undefined) setAdminFee(res.service_fee);
      if (res.payment_enabled !== undefined) setPaymentEnabled(res.payment_enabled);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const storedFrame = localStorage.getItem('selected_frame');
      const storedSlots = localStorage.getItem('arranged_slots_list') || localStorage.getItem('arranged_slots');
      const savedPhotos = localStorage.getItem('captured_photos');

      // Check if session ID is stored in captured_photos or config
      // We can also retrieve the latest active session from backend if needed
      if (!storedFrame || !storedSlots) {
        toast.error('Sesi checkout tidak ditemukan, silakan mulai ulang.');
        router.push('/booth');
        return;
      }

      const frame: Frame = JSON.parse(storedFrame);
      const parsedSlots = JSON.parse(storedSlots);
      const slotsList: SlotData[][] = Array.isArray(parsedSlots[0]) ? parsedSlots : [parsedSlots];
      const coords = getParsedCoordinates(frame);

      setSelectedFrame(frame);
      setSlotsDataList(slotsList);
      setCoordinates(coords);

      // Attempt to find session ID
      // PhotoSession is typically created on mount in booth page
      // Let's check if we have a session ID
      // If we don't have it, we can fallback to completing locally or offline
      const storedSession = localStorage.getItem('active_session_id');
      if (storedSession) {
        setSessionId(storedSession);
      }

      // Restore pending payment state if it exists
      const pendingPayment = localStorage.getItem('pending_payment');
      if (pendingPayment) {
        try {
          const { qrUrl, qrString, sessionId: paymentSessionId, expiresAt } = JSON.parse(pendingPayment);
          // Only restore if not expired (QR valid for 10 minutes)
          if (expiresAt && Date.now() < expiresAt) {
            setPaymentQrUrl(qrUrl || null);
            setPaymentQrString(qrString || null);
            if (paymentSessionId) setSessionId(paymentSessionId);
            const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);
            setCountdown(remainingSeconds);
            setPaymentStep('details');
            setShowPaymentModal(true);
          } else {
            // Expired — clean up
            localStorage.removeItem('pending_payment');
          }
        } catch {
          localStorage.removeItem('pending_payment');
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data checkout.');
      router.push('/select-frame');
    }
  }, [isMounted, router]);

  // Auto-complete event session if detected
  useEffect(() => {
    if (!isMounted || !isEventSession || !sessionId || !selectedFrame) return;

    const autoProcessEventSession = async () => {
      setIsInitiatingPayment(true);
      try {
        await syncPhotosToServer(sessionId);
        const finalStripBlobs = await renderStripBlobs();
        const customTexts: string[] = [];
        if (slotsDataList[0] && coordinates.length > 0) {
          coordinates.forEach((slot, i) => {
            if (slot.type === 'text' && slotsDataList[0][i]?.textValue) {
              customTexts.push(slotsDataList[0][i].textValue as string);
            }
          });
        }
        const result = await sessionsApi.complete(Number(sessionId), selectedFrame.id, finalStripBlobs, 150, customTexts);
        toast.success('Foto berhasil diproses!');
        
        // Clean up session info
        localStorage.removeItem('captured_photos');
        localStorage.removeItem('selected_frame');
        localStorage.removeItem('active_session_id');
        localStorage.removeItem('event_gif_speed');
        
        // Use UUID for the result URL (secure, non-enumerable)
        const resultId = result?.session?.uuid || result?.uuid || sessionId;
        router.push(`/result/${resultId}`);
      } catch (err: any) {
        console.error('Auto event session processing error:', err);
        toast.error(err?.message || 'Gagal memproses foto event.');
        setIsInitiatingPayment(false);
      }
    };

    autoProcessEventSession();
  }, [isMounted, isEventSession, sessionId, selectedFrame]);

  // Countdown timer for simulated payment gateway
  useEffect(() => {
    if (!showPaymentModal || paymentStep !== 'details') return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [showPaymentModal, paymentStep]);

  // Poll payment status
  useEffect(() => {
    if (!showPaymentModal || paymentStep !== 'details' || !sessionId) return;

    let isStopped = false;
    const pollStatus = async () => {
      try {
        const session = await sessionsApi.paymentStatus(sessionId);
        if (isStopped) return;

        if (session.payment_status === 'paid') {
          isStopped = true;
          setPaymentStep('processing');
          setIsFinalizing(true);
          
          try {
            // Render the custom strip matching coordinates and adjustments on client
            const finalStripBlobs = await renderStripBlobs();
            const customTexts: string[] = [];
            if (slotsDataList[0] && coordinates.length > 0) {
              coordinates.forEach((slot, i) => {
                if (slot.type === 'text' && slotsDataList[0][i]?.textValue) {
                  customTexts.push(slotsDataList[0][i].textValue as string);
                }
              });
            }
            // Complete the session and upload the custom strip
            const completeResult = await sessionsApi.complete(Number(sessionId), selectedFrame?.id, finalStripBlobs, 150, customTexts);
            
            toast.success('Pembayaran sukses & foto berhasil diproses!');
            setPaymentStep('success');
            localStorage.removeItem('pending_payment'); // clear persisted QR
            
            setTimeout(() => {
              setShowPaymentModal(false);
              // Clean up local storage (keep arranged_slots for result page to re-render)
              localStorage.removeItem('captured_photos');
              localStorage.removeItem('selected_frame');
              localStorage.removeItem('active_session_id');
              localStorage.removeItem('event_gif_speed');
              // Navigate to online result page using UUID (secure)
              const resultId = completeResult?.session?.uuid || completeResult?.uuid || sessionId;
              router.push(`/result/${resultId}`);
            }, 2000);
          } catch (completeErr) {
            console.error('Failed to render or complete session client-side:', completeErr);
            toast.success('Pembayaran sukses!');
            setPaymentStep('success');
            localStorage.removeItem('pending_payment'); // clear persisted QR
            setTimeout(() => {
              setShowPaymentModal(false);
              // Keep arranged_slots for result page to re-render correctly
              localStorage.removeItem('captured_photos');
              localStorage.removeItem('selected_frame');
              localStorage.removeItem('active_session_id');
              // Fallback to integer session ID if uuid unavailable
              router.push(`/result/${sessionId}`);
            }, 2000);
          }
        } else if (session.payment_status !== 'pending' && session.payment_status !== 'unpaid') {
          toast.error(`Pembayaran gagal atau kedaluwarsa: status ${session.payment_status}`);
          localStorage.removeItem('pending_payment'); // clear expired QR
          setShowPaymentModal(false);
          isStopped = true;
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    };

    const interval = setInterval(pollStatus, 3000);
    pollStatus(); // Initial check

    return () => {
      isStopped = true;
      clearInterval(interval);
    };
  }, [showPaymentModal, paymentStep, sessionId, router, selectedFrame]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to convert base64 to Blob
  const base64ToBlob = (base64Data: string, contentType = 'image/jpeg'): Blob => {
    const parts = base64Data.split(';base64,');
    const byteCharacters = atob(parts[parts.length - 1]);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: contentType });
  };

  const syncPhotosToServer = async (targetSessionId: string | number): Promise<void> => {
    try {
      const storedPhotos = localStorage.getItem('captured_photos');
      if (!storedPhotos) return;
      
      const localPhotos: { slot: number; url: string }[] = JSON.parse(storedPhotos);
      if (localPhotos.length === 0) return;
      
      // Fetch session state from backend
      const backendSession = await sessionsApi.get(targetSessionId);
      const backendPhotos: { id: number; slot_index: number }[] = backendSession.photos || [];
      
      // Find missing slots
      const missingPhotos = localPhotos.filter(local => 
        !backendPhotos.some(backend => backend.slot_index === local.slot)
      );
      
      if (missingPhotos.length === 0) {
        console.log('All photos are already uploaded on backend.');
        return;
      }
      
      console.log(`Syncing ${missingPhotos.length} missing photos to backend for session ${targetSessionId}...`);
      
      // Upload missing photos
      for (const photo of missingPhotos) {
        const blob = base64ToBlob(photo.url);
        await sessionsApi.uploadPhoto(Number(targetSessionId), photo.slot, blob);
      }
      
      console.log('Photo sync complete.');
    } catch (err) {
      console.error('Error syncing photos to server:', err);
      throw new Error('Gagal mensinkronisasikan foto ke server. Silakan coba lagi.');
    }
  };

  // ── Helper: load gambar via fetch→blob→objectURL (bypass CORS canvas taint) ──
  const loadImageFromUrl = async (url: string): Promise<HTMLImageElement> => {
    const headers: HeadersInit = { 'ngrok-skip-browser-warning': '69420' };
    const token = typeof window !== 'undefined' ? localStorage.getItem('fotoseeni_token') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status} saat load: ${url}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Gagal decode: ${url}`)); };
      img.src = objectUrl;
    });
  };

  const renderStripBlobs = async (): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    for (let printIndex = 0; printIndex < slotsDataList.length; printIndex++) {
      const slotsData = slotsDataList[printIndex];
      const blob = await renderSingleStripBlob(slotsData);
      blobs.push(blob);
    }
    return blobs;
  };

  const renderSingleStripBlob = (slotsData: SlotData[]): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      const frameImg = document.querySelector('img[alt="Frame Overlay"]') as HTMLImageElement;
      if (!frameImg) {
        reject(new Error('Frame overlay image tidak ditemukan'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = frameImg.naturalWidth || 1200;
      canvas.height = frameImg.naturalHeight || 1800;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal mendapatkan context 2d canvas'));
        return;
      }

      const screenFrameWidth = frameImg.clientWidth || 300;
      const scaleRatio = canvas.width / screenFrameWidth;
      const objectUrls: string[] = [];

      try {
        // Draw photos
        for (let i = 0; i < coordinates.length; i++) {
          const slot = coordinates[i];
          const data = slotsData[i];
          if (!data || slot.type === 'text' || !data.photoUrl) continue;

          // For captured photos, they might already be blob URLs or base64. 
          // If they are local data URIs or blob URLs, we can just use them, 
          // but for safety, loadImageFromUrl handles HTTP requests and falls back for others if needed.
          // In checkout, captured photos from webcam are base64, so fetch(base64) works and creates a blob.
          const img = await loadImageFromUrl(data.photoUrl);
          if (img.src.startsWith('blob:')) objectUrls.push(img.src);

          const x = ((slot.x_percent ?? slot.x ?? 0) / 100) * canvas.width;
          const y = ((slot.y_percent ?? slot.y ?? 0) / 100) * canvas.height;
          const w = ((slot.width_percent ?? slot.width ?? 0) / 100) * canvas.width;
          const h = ((slot.height_percent ?? slot.height ?? 0) / 100) * canvas.height;

          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          const scaleToCover = Math.max(w / imgW, h / imgH);
          const drawW = imgW * scaleToCover;
          const drawH = imgH * scaleToCover;

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();

          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate((data.rotate * Math.PI) / 180);
          ctx.scale(data.scale, data.scale);
          ctx.translate(data.translateX * scaleRatio, data.translateY * scaleRatio);

          if (selectedFrame?.is_bw) ctx.filter = 'grayscale(100%)';
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.filter = 'none';
          
          ctx.restore();
        }

        // Draw frame overlay on top
        const frameSrc = selectedFrame 
          ? `${BACKEND_URL}/api/frame-templates/${selectedFrame.id}/image` 
          : frameImg.src;
        const frameImage = await loadImageFromUrl(frameSrc);
        if (frameImage.src.startsWith('blob:')) objectUrls.push(frameImage.src);

        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

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
          // We constrain the text drawing to the slot boundaries
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          
          // Use admin-configured fontSize if available, otherwise calculate proportionally
          let fontSize: number;
          if (slot.fontSize) {
            // Scale the configured fontSize proportionally to the canvas dimensions
            // The fontSize was set relative to a preview, we scale by canvas/frame ratio
            const previewW = 400; // typical preview frame width in px
            const canvasScale = canvas.width / previewW;
            fontSize = slot.fontSize * canvasScale;
          } else {
            fontSize = Math.min(h * 0.6, w * 0.15, 80);
          }
          ctx.font = `bold ${fontSize}px ${slot.fontFamily || 'Inter'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw a subtle outline for contrast (white if text is dark, black if text is light)
          const textColor = slot.color || '#000000';
          ctx.fillStyle = textColor;
          ctx.strokeStyle = textColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
          ctx.lineWidth = Math.max(2, fontSize * 0.05);
          ctx.strokeText(data.textValue, x + w / 2, y + h / 2);
          
          // Draw text centered within the text slot rect
          ctx.fillText(data.textValue, x + w / 2, y + h / 2);
          
          ctx.restore();
        }

        canvas.toBlob((blob) => {
          objectUrls.forEach(u => URL.revokeObjectURL(u));
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Gagal mengekspor canvas ke Blob'));
          }
        }, 'image/jpeg', 0.95);
      } catch (err) {
        objectUrls.forEach(u => URL.revokeObjectURL(u));
        reject(err);
      }
    });
  };

  const handlePayNow = async () => {
    if (!sessionId) {
      toast.error('Sesi aktif tidak ditemukan.');
      return;
    }

    setIsInitiatingPayment(true);
    try {
      // Sync photos to server first
      await syncPhotosToServer(sessionId);

      const returnUrl = window.location.origin + `/result/${sessionId}`;
      const res = await sessionsApi.pay(sessionId, returnUrl, selectedFrame?.id);
      
      if (res.status === 'success') {
        const qrUrl = res.payment_info?.qr_url || null;
        const qrString = res.payment_info?.qr_string || null;
        setPaymentQrUrl(qrUrl);
        setPaymentQrString(qrString);
        setCountdown(600);
        setPaymentStep('details');
        setShowPaymentModal(true);
        // Persist QR state so refresh doesn't lose the modal
        localStorage.setItem('pending_payment', JSON.stringify({
          qrUrl,
          qrString,
          sessionId,
          expiresAt: Date.now() + 600_000, // 10 minutes
        }));
      } else {
        toast.error(res.message || 'Gagal menginisiasi pembayaran dengan Paymenku.');
      }
    } catch (err: any) {
      console.error('Payment initiation error:', err);
      toast.error(err.message || 'Gagal membuat tagihan pembayaran. Pastikan API Key dikonfigurasi di dashboard admin.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const handleSimulateSuccess = async () => {
    setPaymentStep('processing');
    setIsFinalizing(true);
    
    try {
      // Find the session ID to complete.
      let activeSession = sessionId;
      if (!activeSession) {
        // Fallback: search for active_session_id in other storage keys if needed
        const savedPhotos = localStorage.getItem('captured_photos');
      }
 
      if (activeSession && selectedFrame) {
        // Sync photos to server first
        await syncPhotosToServer(activeSession);

        // Render the custom strip matching coordinates and adjustments on client
        const finalStripBlobs = await renderStripBlobs();

        // Complete the session in the backend so it composites the strip
        const completeResult = await sessionsApi.complete(Number(activeSession), selectedFrame.id, finalStripBlobs, 150);
        toast.success('Pembayaran sukses & foto berhasil diproses!');
        setPaymentStep('success');
        
        setTimeout(() => {
          setShowPaymentModal(false);
          // Keep arranged_slots for result page to re-render correctly
          localStorage.removeItem('captured_photos');
          localStorage.removeItem('selected_frame');
          localStorage.removeItem('active_session_id');
          localStorage.removeItem('event_gif_speed');
          // Navigate to online result page using UUID (secure)
          const resultId = completeResult?.session?.uuid || completeResult?.uuid || activeSession;
          router.push(`/result/${resultId}`);
        }, 2000);
      } else {
        // Offline / local fallback if no backend session
        toast.success('Pembayaran sukses! Memproses hasil lokal...');
        setPaymentStep('success');
        setTimeout(() => {
          setShowPaymentModal(false);
          router.push('/result/local');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to complete session:', err);
      toast.error(err?.message || 'Gagal merender foto strip. Silakan coba lagi.');
      setPaymentStep('details');
      setIsFinalizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Berhasil disalin ke clipboard!');
  };

  // ── Free session (payment disabled by admin) ─────────────────────────────
  const handleFreeSession = async () => {
    if (!sessionId) {
      toast.error('Sesi aktif tidak ditemukan.');
      return;
    }
    setIsInitiatingPayment(true);
    try {
      await syncPhotosToServer(sessionId);
      const finalStripBlobs = await renderStripBlobs();
      const completeResult = await sessionsApi.complete(Number(sessionId), selectedFrame?.id, finalStripBlobs, 150);
      toast.success('Foto berhasil diproses!');
      // Keep arranged_slots for result page to re-render correctly
      localStorage.removeItem('captured_photos');
      localStorage.removeItem('selected_frame');
      localStorage.removeItem('active_session_id');
      localStorage.removeItem('event_gif_speed');
      // Use UUID for result URL (secure, non-enumerable)
      const resultId = completeResult?.session?.uuid || completeResult?.uuid || sessionId;
      router.push(`/result/${resultId}`);
    } catch (err: any) {
      console.error('Free session error:', err);
      toast.error(err?.message || 'Gagal memproses foto. Silakan coba lagi.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1D1D23]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin" />
          <p className="text-white font-bold text-lg">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!selectedFrame) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1D1D23]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#8A2BE2] animate-spin" />
          <p className="text-white font-bold text-lg">Memuat halaman checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen md:h-screen bg-[#FFFDF7] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative">
      {/* ── Overlays ── */}
      {isEventSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FFFDF7]">
          <div className="max-w-md w-full px-6 text-center flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 border-8 border-[#8A2BE2] border-t-transparent rounded-full animate-spin flex items-center justify-center" />
              <Camera className="w-8 h-8 text-[#8A2BE2] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#1D1D23] uppercase tracking-tight animate-pulse">Memproses Foto Event</h2>
              <p className="text-sm font-semibold text-gray-500">
                Sedang menggabungkan foto Anda ke dalam frame. Silakan tunggu beberapa saat...
              </p>
            </div>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 w-full text-xs font-bold text-[#8A2BE2] flex items-center justify-center gap-2 shadow-[3px_3px_0px_#1D1D23]">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-bounce" />
              Sesi Event Lunas — Menuju Halaman Hasil Foto
            </div>
          </div>
        </div>
      )}
      
      {/* ═══ Tombol Kembali (pojok kiri atas) ═══ */}
      <button
        onClick={() => router.push('/edit-photo')}
        className="fixed top-4 left-4 z-40 w-11 h-11 flex items-center justify-center rounded-full bg-white border-3 border-[#1D1D23] shadow-[3px_3px_0px_#1D1D23] hover:bg-slate-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1D1D23] transition-all active:scale-95 cursor-pointer"
        title="Kembali ke Edit Foto"
      >
        <ArrowLeft className="w-5 h-5 text-[#1D1D23]" strokeWidth={3} />
      </button>

      {/* ─── PANEL KIRI: Preview Frame Strip (Flex-1) ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100 border-b-4 md:border-b-0 md:border-r-4 border-slate-900 min-h-[50vh] md:h-full relative overflow-hidden shrink-0">
        <div className="text-center mb-4 mt-12 md:mt-0">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Preview Foto Strip Anda</h1>
          <p className="text-slate-600 font-bold text-xs uppercase tracking-wider mt-1">Ini adalah hasil akhir cetak digital Anda</p>
        </div>

        {/* Outer Frame Container */}
        <div className="relative inline-block overflow-hidden max-h-[60vh] md:max-h-[65vh]">
          {/* Photo slots layer */}
          {coordinates.map((slot, index) => {
            const slotsData = slotsDataList[0] || [];
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
                className="overflow-hidden flex items-center justify-center relative bg-slate-100"
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

          {/* Frame Template PNG overlay */}
          <img
            src={getFrameImageUrl(selectedFrame)}
            alt="Frame Overlay"
            className="max-h-[60vh] md:max-h-[65vh] w-auto block relative z-10 pointer-events-none"
          />
        </div>
      </div>

      {/* ─── PANEL KANAN: Checkout & Payment Details (Width: 450px) ─── */}
      <div className="w-full md:w-[450px] bg-[#FFFDF7] flex flex-col justify-between h-auto md:h-full p-6 md:overflow-y-auto pt-8 md:pt-6">
        
        {/* Header Rincian */}
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4 uppercase">Rincian Belanja</h2>
          
          {/* Product Box */}
          <div className="bg-white border-3 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_#1D1D23] mb-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-[#8A2BE2] text-white font-black text-[10px] px-2 py-0.5 rounded border-2 border-slate-900">
                  DIGITAL STRIP
                </span>
                <h3 className="font-black text-slate-900 text-lg mt-2 uppercase">{selectedFrame.name} - Photo Strip</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">High-Resolution Digital JPEG & Unlimited Shares</p>
              </div>
              <span className="font-extrabold text-slate-900">Rp 25.000</span>
            </div>
          </div>

          {/* Payment Method Details (QRIS Only) */}
          <div className="bg-white border-3 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_#1D1D23] mb-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 border-2 border-indigo-600 rounded-xl text-indigo-700 animate-pulse">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Metode Pembayaran</h3>
              <p className="text-xs text-gray-500 font-bold mt-0.5">QRIS GPN (Instan & Otomatis)</p>
            </div>
          </div>
        </div>

        {/* Rincian Harga & Tombol Bayar */}
        <div className="mt-6">
          {isEventSession ? (
            // ── MODE EVENT (sudah bayar via redeem code) ──
            <>
              <div className="border-t-3 border-dashed border-slate-900 pt-4 mb-4">
                <div className="bg-purple-50 border-2 border-[#8A2BE2] rounded-xl p-3 mb-4">
                  <p className="text-xs font-black text-[#8A2BE2] uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Sesi Event — Sudah Lunas
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Pembayaran sudah selesai via kode redeem. Langsung proses hasil foto kamu!</p>
                  {eventRedeemCode && <p className="text-xs font-mono font-black text-[#8A2BE2] mt-1">Kode: {eventRedeemCode}</p>}
                </div>
                <div className="flex justify-between text-lg font-black text-emerald-700">
                  <span>Total Pembayaran</span>
                  <span>LUNAS ✅</span>
                </div>
              </div>
              <button
                onClick={handleFreeSession}
                disabled={isInitiatingPayment}
                className="w-full py-4.5 rounded-2xl font-extrabold text-lg border-4 border-slate-900 bg-[#8A2BE2] text-white shadow-[4px_4px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0px_#1D1D23] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isInitiatingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> MEMPROSES FOTO...</>
                ) : (
                  <><Camera className="w-5 h-5" /> SELESAIKAN & LIHAT HASIL →</>
                )}
              </button>
              <p className="text-[10px] text-center text-gray-500 font-bold mt-3 uppercase tracking-wider flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Sesi Event — Tanpa Pembayaran Tambahan
              </p>
            </>
          ) : paymentEnabled ? (
            // ── MODE BERBAYAR ──
            <>
              <div className="border-t-3 border-dashed border-slate-900 pt-4 mb-4 flex flex-col gap-2">
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Biaya Cetak Digital</span>
                  <span>Rp {price.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Biaya Layanan</span>
                  <span>Rp {adminFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-slate-900 border-t-2 border-slate-200 pt-2 mt-1">
                  <span>Total Pembayaran</span>
                  <span>Rp {totalPayment.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <button
                onClick={handlePayNow}
                disabled={isInitiatingPayment}
                className="w-full py-4.5 rounded-2xl font-extrabold text-lg border-4 border-slate-900 bg-[#8A2BE2] text-white shadow-[4px_4px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0px_#1D1D23] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isInitiatingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> MEMPROSES PEMBAYARAN...</>
                ) : (
                  'BAYAR SEKARANG'
                )}
              </button>
              <p className="text-[10px] text-center text-gray-500 font-bold mt-3 uppercase tracking-wider flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Transaksi Aman & Terenkripsi
              </p>
            </>
          ) : (
            // ── MODE GRATIS (payment dinonaktifkan admin) ──
            <>
              <div className="border-t-3 border-dashed border-slate-900 pt-4 mb-4">
                <div className="flex justify-between text-lg font-black text-emerald-700">
                  <span>Total Pembayaran</span>
                  <span>GRATIS 🎉</span>
                </div>
                <p className="text-xs text-emerald-600 font-bold mt-1">Pembayaran sedang dinonaktifkan oleh admin.</p>
              </div>
              <button
                onClick={handleFreeSession}
                disabled={isInitiatingPayment}
                className="w-full py-4.5 rounded-2xl font-extrabold text-lg border-4 border-slate-900 bg-emerald-500 text-white shadow-[4px_4px_0px_#1D1D23] hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0px_#1D1D23] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isInitiatingPayment ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> MEMPROSES FOTO...</>
                ) : (
                  'PROSES & LIHAT HASIL →'
                )}
              </button>
              <p className="text-[10px] text-center text-gray-500 font-bold mt-3 uppercase tracking-wider flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Tidak diperlukan pembayaran
              </p>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           MODAL OVERLAY: Paymentku Payment Gateway (Fintech Simulator)
           ═══════════════════════════════════════════════════════════════════ */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#FFFDF7] border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_#1D1D23] p-6 max-w-md w-full flex flex-col gap-5 max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95">
            
            {/* Logo & Close */}
            <div className="flex justify-between items-center border-b-2 border-slate-200 pb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 border-2 border-slate-900 flex items-center justify-center shadow-[1px_1px_0px_#000]">
                  <CreditCard className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-black text-slate-950 text-md tracking-tight uppercase">
                  fotoseeni <span className="text-indigo-600">Pay</span>
                </span>
              </div>
              <button
                onClick={() => !isFinalizing && setShowPaymentModal(false)}
                disabled={isFinalizing}
                className="p-1 rounded-full border-2 border-slate-900 bg-white hover:bg-red-50 text-slate-900 cursor-pointer disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {paymentStep === 'details' && (
              <>
                {/* Invoice Header */}
                <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23] text-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Tagihan</span>
                  <h2 className="text-3xl font-black text-slate-950 mt-1">Rp {totalPayment.toLocaleString('id-ID')}</h2>
                  <div className="flex items-center justify-center gap-1.5 text-amber-500 text-xs font-bold mt-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Selesaikan dalam {formatTime(countdown)}</span>
                  </div>
                </div>

                {/* Main Payment Gateway Content based on Payment Method */}
                {paymentMethod === 'qris' && (
                  <div className="flex flex-col items-center bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_#1D1D23]">
                    <span className="bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded border border-slate-900 shadow-[1px_1px_0px_#000] mb-3 uppercase">
                      QRIS GPN NASIONAL
                    </span>
                    
                    {/* QR Code Container */}
                    <div className="relative w-48 h-48 border-3 border-slate-900 bg-white flex flex-col items-center justify-center p-2 rounded-xl overflow-hidden">
                      {paymentQrUrl ? (
                        <img
                          src={paymentQrUrl}
                          alt="QRIS Code"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 h-full text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
                          <span className="text-[10px] font-bold">Membuat QRIS...</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold mt-3 uppercase text-center">Scan QR menggunakan GoPay, OVO, Dana, LinkAja, BCA Mobile</span>
                  </div>
                )}


              </>
            )}

            {paymentStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-16 h-16 animate-spin text-indigo-600" />
                <h3 className="font-black text-slate-900 text-xl text-center">Memproses Pembayaran...</h3>
                <p className="text-slate-500 font-bold text-center text-sm">Menunggu konfirmasi pembayaran & merender foto strip Anda secara online.</p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-slate-900 flex items-center justify-center shadow-[4px_4px_0px_#000] animate-bounce">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="font-black text-slate-950 text-2xl uppercase">Pembayaran Sukses!</h3>
                <p className="text-slate-600 font-extrabold text-sm">Terima kasih atas pembayaran Anda. Anda akan dialihkan ke halaman unduhan.</p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
