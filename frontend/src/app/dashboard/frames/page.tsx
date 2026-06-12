'use client';

import { useEffect, useState } from 'react';
import { framesApi } from '@/lib/api';
import { Loader2, Trash2, Image as ImageIcon, Frame } from 'lucide-react';
import { toast } from 'sonner';

export default function MyFramesPage() {
  const [myFrames, setMyFrames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFrames = async () => {
    try {
      const data = await framesApi.list();
      // The /frames endpoint returns all frames mapped from frame_templates
      // For user frames, we might need the old frames API
      setMyFrames(Array.isArray(data) ? data : (data.user ?? data.data ?? []));
    } catch (err) {
      console.error('Failed to load frames:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrames();
  }, []);


  const handleDeleteFrame = async (id: number) => {
    if (!confirm('Delete this frame?')) return;
    try {
      await framesApi.delete(id);
      toast.success('Frame deleted!');
      loadFrames();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete frame.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-[#1D1D23]">🖼 My Frames</h2>


      {/* Frames Grid */}
      <div>
        <h3 className="text-lg font-extrabold text-[#1D1D23] mb-4">Your Uploaded Frames</h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
          </div>
        ) : myFrames.length === 0 ? (
          <div className="neobrutal-box bg-white p-10 text-center shadow-[4px_4px_0px_#1D1D23]">
            <Frame className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">No frames uploaded yet.</p>
            <p className="text-sm text-gray-400 mt-1">Upload your first custom frame above! 🎨</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {myFrames.map((frame: any) => (
              <div key={frame.id} className="neobrutal-box bg-white overflow-hidden shadow-[4px_4px_0px_#1D1D23] flex flex-col group hover:shadow-[6px_6px_0px_#1D1D23] transition-all">
                <div className="aspect-square bg-[repeating-conic-gradient(#f3f4f6_0%_25%,transparent_0%_50%)_0_0/20px_20px] relative overflow-hidden flex items-center justify-center p-3">
                  {frame.image_url || frame.file_path ? (
                    <img
                      src={frame.image_url || frame.file_path}
                      alt={frame.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-gray-300" />
                  )}
                </div>
                <div className="p-3 flex justify-between items-center gap-2 border-t-2 border-[#1D1D23]">
                  <span className="text-sm font-bold text-[#1D1D23] truncate">{frame.name}</span>
                  <button
                    onClick={() => handleDeleteFrame(frame.id)}
                    className="p-1.5 bg-red-100 text-red-600 rounded-full border-2 border-[#1D1D23] hover:bg-red-200 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
