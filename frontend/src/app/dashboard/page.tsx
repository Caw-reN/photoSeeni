'use client';

import { useEffect, useState } from 'react';
import { sessionsApi } from '@/lib/api';
import { Camera, Trash2, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function DashboardGalleryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await sessionsApi.listMySessions();
        let sessionsArray: any[] = [];
        if (Array.isArray(data)) {
          sessionsArray = data;
        } else if (data && Array.isArray(data.data)) {
          sessionsArray = data.data;
        } else if (data && Array.isArray(data.sessions)) {
          sessionsArray = data.sessions;
        }
        setSessions(sessionsArray);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeleteSession = async (id: number) => {
    if (!confirm('Delete this photo session?')) return;
    try {
      await sessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert('Failed to delete session.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="neobrutal-box bg-white p-10 text-center shadow-[4px_4px_0px_#1D1D23]">
        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-xl text-gray-400 font-bold mb-2">No photo sessions yet!</p>
        <p className="text-gray-400 mb-6">Start a new session to capture some fun moments 📸</p>
        <Link href="/booth" className="neobrutal-button inline-flex px-6 py-3 bg-[#8A2BE2] text-white gap-2 items-center text-sm hover:bg-[#9b42ef]">
          <Camera className="w-4 h-4" /> Start Your First Session
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-black text-[#1D1D23] mb-4">📸 My Photo Sessions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sessions.map((session) => (
          <div key={session.id} className="neobrutal-box bg-white overflow-hidden shadow-[4px_4px_0px_#1D1D23] flex flex-col group hover:shadow-[6px_6px_0px_#1D1D23] transition-all">
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              {session.final_image_url ? (
                <img
                  src={session.final_image_url}
                  alt={`Session ${session.id}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-xs font-bold text-gray-400">
                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <div className="flex gap-1">
                {session.final_image_url && (
                  <a
                    href={session.final_image_url}
                    download={`fotoseeni-${session.id}.jpg`}
                    className="p-1.5 bg-[#3B82F6] text-white rounded-full border-2 border-[#1D1D23] hover:bg-[#4f8ff7] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="p-1.5 bg-red-100 text-red-600 rounded-full border-2 border-[#1D1D23] hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
