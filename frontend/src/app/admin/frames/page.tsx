'use client';

import { useEffect, useState } from 'react';
import { frameTemplatesApi } from '@/lib/api';
import { Loader2, Trash2, Image as ImageIcon, Eye, EyeOff, User, Circle, Edit2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const BACKEND_URL = (() => {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (u && !u.startsWith('/')) return u.replace(/\/api\/?$/, '');
  return '';
})();

const proxyImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  const abs = url.startsWith('http') ? url : `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  return `/api/proxy-image?url=${encodeURIComponent(abs)}`;
};

export default function AdminFramesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  const loadTemplates = async () => {
    try {
      const data = await frameTemplatesApi.list();
      setTemplates(data.data ?? data ?? []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleToggleActive = async (id: number | string) => {
    try {
      await frameTemplatesApi.toggleActive(id);
      toast.success('Template status updated!');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const handleToggleBw = async (id: number | string) => {
    try {
      await frameTemplatesApi.toggleBw(id);
      toast.success('Filter B&W updated!');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update B&W filter.');
    }
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm('Delete this frame template? This cannot be undone.')) return;
    try {
      await frameTemplatesApi.delete(id);
      toast.success('Frame template deleted!');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#1D1D23]">🖼 Frame Templates</h2>
        <Link 
          href="/admin/builder"
          className="px-5 py-2.5 border-3 border-[#1D1D23] bg-[#8A2BE2] text-white rounded-xl shadow-[3px_3px_0px_#1D1D23] font-black text-sm flex items-center gap-2 hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1D1D23] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1D1D23] transition-all"
        >
          <Plus className="w-4 h-4" /> Add Custom Frame
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="neobrutal-box bg-white p-10 text-center shadow-[4px_4px_0px_#1D1D23]">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-bold">No frame templates yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="neobrutal-box bg-white overflow-hidden shadow-[4px_4px_0px_#1D1D23] flex flex-col group hover:shadow-[6px_6px_0px_#1D1D23] transition-all">
              {/* Thumbnail with B&W preview if is_bw */}
              <div className="aspect-square bg-[repeating-conic-gradient(#f3f4f6_0%_25%,transparent_0%_50%)_0_0/20px_20px] relative overflow-hidden flex items-center justify-center p-3">
                {tmpl.image_url ? (
                  <img
                    src={proxyImageUrl(tmpl.image_url)}
                    alt={tmpl.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    style={tmpl.is_bw ? { filter: 'grayscale(1)' } : {}}
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-gray-300" />
                )}
                {/* B&W Badge overlay */}
                {tmpl.is_bw && (
                  <div className="absolute top-1.5 left-1.5 bg-[#1D1D23] text-white text-[9px] font-black px-1.5 py-0.5 rounded border border-white/30 tracking-widest">
                    B&W
                  </div>
                )}
              </div>
              <div className="p-3 border-t-2 border-[#1D1D23]">
                <p className="text-sm font-bold text-[#1D1D23] truncate mb-2">{tmpl.name}</p>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border border-[#1D1D23] flex items-center gap-1 ${tmpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tmpl.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {tmpl.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {tmpl.is_bw && (
                    <span className="text-xs font-bold bg-[#1D1D23] text-white px-2 py-0.5 rounded-full border border-[#1D1D23] flex items-center gap-1">
                      <Circle className="w-2.5 h-2.5 fill-white" /> B&W
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {tmpl.user && (
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-[#1D1D23] flex items-center gap-1 truncate max-w-[100px]">
                      <User className="w-3 h-3" />
                      {tmpl.user.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold bg-purple-100 text-[#8A2BE2] px-2 py-0.5 rounded-full border border-[#1D1D23]">
                    {tmpl.slots ? (Array.isArray(tmpl.slots) ? tmpl.slots.length : '?') : '0'} slots
                  </span>
                  <div className="flex-1" />

                  {/* Toggle B&W */}
                  <button
                    onClick={() => handleToggleBw(tmpl.id)}
                    title={tmpl.is_bw ? 'Nonaktifkan B&W' : 'Aktifkan B&W'}
                    className={`p-1.5 rounded-full border-2 border-[#1D1D23] transition-colors ${
                      tmpl.is_bw
                        ? 'bg-[#1D1D23] text-white hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <Circle className={`w-3.5 h-3.5 ${tmpl.is_bw ? 'fill-white' : ''}`} />
                  </button>

                  {/* Edit Template */}
                  <Link
                    href={`/admin/frames/${tmpl.id}/edit`}
                    title="Edit Template"
                    className="p-1.5 rounded-full border-2 border-[#1D1D23] bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Link>

                  {/* Toggle Active */}
                  <button
                    onClick={() => handleToggleActive(tmpl.id)}
                    title={tmpl.is_active ? "Deactivate" : "Activate"}
                    className={`p-1.5 rounded-full border-2 border-[#1D1D23] transition-colors ${
                      tmpl.is_active 
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {tmpl.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    className="p-1.5 bg-red-100 text-red-600 rounded-full border-2 border-[#1D1D23] hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
