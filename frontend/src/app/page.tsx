import Link from 'next/link';
import { Camera, Sparkles, Smile, Heart, Share2, Upload } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFFDF7]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6 text-center">
        {/* Playful backgrounds shapes */}
        <div className="absolute top-10 left-10 w-24 h-24 bg-amber-200 rounded-full blur-xl opacity-75 -z-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-200 rounded-full blur-xl opacity-75 -z-10 animate-bounce"></div>

        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 border-2 border-[#1D1D23] rounded-full shadow-[2px_2px_0px_#1D1D23] text-sm font-black mb-8 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>SAY CHEESE! ONLINE PHOTOBOOTH</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-[#1D1D23] leading-none mb-6">
            Capture Pure Joy,<br />
            <span className="text-[#8A2BE2] relative inline-block">
              Frame Your Smiles!
              <span className="absolute left-0 bottom-1 w-full h-3 bg-yellow-300 -z-10 transform -rotate-1"></span>
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-gray-700 max-w-2xl mb-12 font-medium">
            Turn your webcam into a nostalgic retro photobooth. Apply custom frames, download, and share high-energy memories in seconds! 📸✨
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="neobrutal-button px-8 py-5 bg-[#3B82F6] text-white hover:bg-[#4f8ff7] text-xl flex items-center justify-center gap-3"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Strip / Visual Cards */}
      <section className="py-16 px-6 bg-[#8A2BE2] text-white border-y-3 border-[#1D1D23]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="neobrutal-box bg-white text-[#1D1D23] p-8 flex flex-col items-center text-center shadow-[6px_6px_0px_#1D1D23]">
            <div className="p-4 bg-purple-100 rounded-full border-2 border-[#1D1D23] mb-6">
              <Camera className="w-8 h-8 text-[#8A2BE2]" />
            </div>
            <h3 className="text-2xl font-extrabold mb-3">Live Camera View</h3>
            <p className="text-gray-600 font-medium">
              Mirrored preview for natural capturing, timers, and quick templates.
            </p>
          </div>

          <div className="neobrutal-box bg-white text-[#1D1D23] p-8 flex flex-col items-center text-center shadow-[6px_6px_0px_#1D1D23]">
            <div className="p-4 bg-amber-100 rounded-full border-2 border-[#1D1D23] mb-6">
              <Smile className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-2xl font-extrabold mb-3">Retro Custom Frames</h3>
            <p className="text-gray-600 font-medium">
              Pick global templates or upload your own transparent PNG designs!
            </p>
          </div>

          <div className="neobrutal-box bg-white text-[#1D1D23] p-8 flex flex-col items-center text-center shadow-[6px_6px_0px_#1D1D23]">
            <div className="p-4 bg-orange-100 rounded-full border-2 border-[#1D1D23] mb-6">
              <Share2 className="w-8 h-8 text-[#FF7F50]" />
            </div>
            <h3 className="text-2xl font-extrabold mb-3">Instant Sharing</h3>
            <p className="text-gray-600 font-medium">
              Download your photobooth strip or share via clean optimized public links.
            </p>
          </div>
        </div>
      </section>

      {/* Playful Guide Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="w-full lg:w-1/2 flex justify-center">
            {/* Visual strip illustration */}
            <div className="neobrutal-box bg-white p-4 w-[280px] shadow-[8px_8px_0px_#1D1D23] rotate-3 hover:rotate-0 transition-transform">
              <div className="aspect-[4/3] bg-zinc-200 border-2 border-[#1D1D23] rounded-lg mb-3 flex items-center justify-center">
                <Smile className="w-12 h-12 text-zinc-500" />
              </div>
              <div className="aspect-[4/3] bg-zinc-200 border-2 border-[#1D1D23] rounded-lg mb-3 flex items-center justify-center">
                <Heart className="w-12 h-12 text-red-400" />
              </div>
              <div className="aspect-[4/3] bg-zinc-200 border-2 border-[#1D1D23] rounded-lg mb-3 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-yellow-500" />
              </div>
              <div className="text-center font-extrabold text-[#1D1D23] py-2 border-t-2 border-dashed border-gray-300">
                FOTOSEENI MEMORIES
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2">
            <h2 className="text-4xl font-extrabold text-[#1D1D23] mb-6">
              How fotoseeni Works 🎬
            </h2>
            <ol className="space-y-6">
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 border-2 border-[#1D1D23] font-bold text-sm">1</span>
                <div>
                  <h4 className="text-lg font-bold text-[#1D1D23]">Pick Your Frame</h4>
                  <p className="text-gray-600">Select standard pastel styles or upload a transparent PNG design overlay.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-400 border-2 border-[#1D1D23] text-white font-bold text-sm">2</span>
                <div>
                  <h4 className="text-lg font-bold text-[#1D1D23]">Take Your 4 Shots</h4>
                  <p className="text-gray-600">Smile, strike a pose, and hit the shutter. Retake any photo inline if you misfired.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-400 border-2 border-[#1D1D23] text-white font-bold text-sm">3</span>
                <div>
                  <h4 className="text-lg font-bold text-[#1D1D23]">Download & Celebrate!</h4>
                  <p className="text-gray-600">The server stitches your photo strip in real time with the frame overlay. Instant download ready!</p>
                </div>
              </li>
            </ol>

            <div className="mt-8">
              <Link
                href="/auth"
                className="neobrutal-button px-6 py-3.5 bg-yellow-400 text-[#1D1D23] hover:bg-yellow-300 text-lg inline-flex items-center gap-2"
              >
                Sign In to Get Started <Sparkles className="w-5 h-5 text-purple-600" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center border-t-3 border-[#1D1D23] bg-white text-gray-500 font-medium">
        <p>© {new Date().getFullYear()} fotoseeni. All rights saved. Let's make the web cheerful again! 💛</p>
      </footer>
    </div>
  );
}
