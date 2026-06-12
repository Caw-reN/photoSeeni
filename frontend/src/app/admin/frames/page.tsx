'use client';

import { useEffect, useState } from 'react';
import { frameTemplatesApi } from '@/lib/api';
import { Loader2, Trash2, Image as ImageIcon, Eye, EyeOff, User } from 'lucide-react';
import { toast } from 'sonner';

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
              <div className="aspect-square bg-[repeating-conic-gradient(#f3f4f6_0%_25%,transparent_0%_50%)_0_0/20px_20px] relative overflow-hidden flex items-center justify-center p-3">
                {tmpl.image_url ? (
                  <img
                    src={tmpl.image_url}
                    alt={tmpl.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-gray-300" />
                )}
              </div>
              <div className="p-3 border-t-2 border-[#1D1D23]">
                <p className="text-sm font-bold text-[#1D1D23] truncate mb-2">{tmpl.name}</p>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border border-[#1D1D23] flex items-center gap-1 ${tmpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tmpl.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {tmpl.is_active ? 'Active' : 'Inactive'}
                  </span>
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
