'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { Download, Share2, Home } from 'lucide-react';
import Link from 'next/link';

export default function LocalResultPage() {
  const router = useRouter();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My SnapJoy Photobooth Strip!',
          text: 'Check out my fun photo strip from SnapJoy!',
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center py-12 px-6">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="text-center mb-8 animate-bounce">
        <h1 className="text-4xl md:text-5xl font-black text-[#1D1D23] uppercase tracking-tight">
          Woohoo! 🎉
        </h1>
        <p className="text-xl text-gray-600 mt-2 font-bold">Your offline photo session is complete!</p>
        <p className="text-sm text-gray-500 mt-2">Create an account next time to stitch and save your photos online.</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={handleShare}
          className="neobrutal-button w-full py-5 bg-[#3B82F6] text-white hover:bg-[#4f8ff7] flex items-center justify-center gap-3 text-lg"
        >
          <Share2 className="w-6 h-6" /> Share Web Link
        </button>

        <div className="my-4 border-t-2 border-dashed border-gray-300"></div>

        <Link
          href="/booth"
          className="neobrutal-button w-full py-4 bg-[#FF7F50] text-[#1D1D23] hover:bg-[#ff8e66] flex items-center justify-center gap-3"
        >
          Take Another One!
        </Link>
        
        <Link
          href="/"
          className="neobrutal-button w-full py-4 bg-gray-100 text-[#1D1D23] hover:bg-gray-200 flex items-center justify-center gap-3"
        >
          <Home className="w-5 h-5" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
