'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FrameBuilder from '@/components/FrameBuilder';
import { frameTemplatesApi } from '@/lib/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function EditFramePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [initialFrame, setInitialFrame] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFrame = async () => {
      try {
        const response = await frameTemplatesApi.get(id);
        const data = await response.json();
        setInitialFrame(data.data);
      } catch (error) {
        toast.error('Failed to load frame template');
        router.push('/admin/frames');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchFrame();
    }
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7F50]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/frames"
          className="p-2 bg-white border-2 border-[#1D1D23] rounded-xl hover:bg-slate-50 transition-colors shadow-[2px_2px_0px_#1D1D23]"
        >
          <ArrowLeft className="w-5 h-5 text-[#1D1D23]" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[#1D1D23] uppercase tracking-tight">Edit Frame Template</h1>
          <p className="text-gray-500 font-bold mt-1">Sesuaikan slot foto dan teks</p>
        </div>
      </div>
      
      <FrameBuilder redirectUrl="/admin/frames" initialFrame={initialFrame} mode="edit" />
    </div>
  );
}
