'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { frameTemplatesApi } from '@/lib/api';

type Slot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: 'photo' | 'text';
  fontFamily?: string;
  color?: string;
  fontSize?: number;
  maxChars?: number;
};

type DragState = {
  type: 'drag' | 'resize';
  slotId: string;
  handle?: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startY: number;
  startSlotX: number;
  startSlotY: number;
  startSlotWidth: number;
  startSlotHeight: number;
};

interface FrameBuilderProps {
  redirectUrl: string;
  initialFrame?: any;
  mode?: 'create' | 'edit';
}

export default function FrameBuilder({ redirectUrl, initialFrame, mode = 'create' }: FrameBuilderProps) {
  const router = useRouter();
  
  const [frameName, setFrameName] = useState(initialFrame?.name || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialFrame?.image_url || null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (initialFrame && initialFrame.slots) {
      setSlots(initialFrame.slots.map((s: any) => ({
        id: Math.random().toString(36).substring(2, 9),
        x: Number(s.x_percent),
        y: Number(s.y_percent),
        width: Number(s.width_percent),
        height: Number(s.height_percent),
        type: s.type || 'photo',
        fontFamily: s.fontFamily,
        color: s.color,
        fontSize: s.fontSize,
        maxChars: s.maxChars,
      })));
    }
  }, [initialFrame]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSlots([]);
    }
  };

  const handleAddSlot = (type: 'photo' | 'text' = 'photo') => {
    const newSlot: Slot = {
      id: Math.random().toString(36).substring(2, 9),
      x: 10,
      y: 10,
      width: type === 'text' ? 50 : 25,
      height: type === 'text' ? 10 : 35,
      type,
      ...(type === 'text' ? { fontFamily: 'Inter', color: '#000000', fontSize: 16, maxChars: 50 } : {}),
    };
    setSlots([...slots, newSlot]);
    setActiveSlotId(newSlot.id);
  };

  const handleDeleteSlot = (id: string) => {
    setSlots(slots.filter((s) => s.id !== id));
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      const percentDeltaX = (deltaX / rect.width) * 100;
      const percentDeltaY = (deltaY / rect.height) * 100;

      setSlots((prevSlots) =>
        prevSlots.map((slot) => {
          if (slot.id !== dragState.slotId) return slot;

          const updated = { ...slot };

          if (dragState.type === 'drag') {
            updated.x = dragState.startSlotX + percentDeltaX;
            updated.y = dragState.startSlotY + percentDeltaY;

            updated.x = Math.max(0, Math.min(100 - updated.width, updated.x));
            updated.y = Math.max(0, Math.min(100 - updated.height, updated.y));
          } else if (dragState.type === 'resize') {
            if (dragState.handle?.includes('e')) {
              updated.width = dragState.startSlotWidth + percentDeltaX;
            }
            if (dragState.handle?.includes('s')) {
              updated.height = dragState.startSlotHeight + percentDeltaY;
            }
            if (dragState.handle?.includes('w')) {
              updated.width = dragState.startSlotWidth - percentDeltaX;
              updated.x = dragState.startSlotX + percentDeltaX;
            }
            if (dragState.handle?.includes('n')) {
              updated.height = dragState.startSlotHeight - percentDeltaY;
              updated.y = dragState.startSlotY + percentDeltaY;
            }

            if (updated.width < 5) updated.width = 5;
            if (updated.height < 5) updated.height = 5;
          }

          return updated;
        })
      );
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState]);

  const handlePointerDown = (
    e: React.PointerEvent,
    slot: Slot,
    type: 'drag' | 'resize',
    handle?: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    setActiveSlotId(slot.id);
    setDragState({
      type,
      slotId: slot.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startSlotX: slot.x,
      startSlotY: slot.y,
      startSlotWidth: slot.width,
      startSlotHeight: slot.height,
    });
  };

  const handleSave = async () => {
    if (!imagePreview) {
      toast.error('Please upload a frame image! 🖼️');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', frameName);
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (mode === 'create') {
        toast.error('Image file is required for new frame!');
        setIsSubmitting(false);
        return;
      }

      const slotsData = slots.map((s, index) => ({
        order: index + 1,
        x_percent: Number(s.x.toFixed(2)),
        y_percent: Number(s.y.toFixed(2)),
        width_percent: Number(s.width.toFixed(2)),
        height_percent: Number(s.height.toFixed(2)),
      }));

      slotsData.forEach((slot, index) => {
        formData.append(`slots[${index}][order]`, slot.order.toString());
        formData.append(`slots[${index}][x_percent]`, slot.x_percent.toString());
        formData.append(`slots[${index}][y_percent]`, slot.y_percent.toString());
        formData.append(`slots[${index}][width_percent]`, slot.width_percent.toString());
        formData.append(`slots[${index}][height_percent]`, slot.height_percent.toString());
        const originalSlot = slots[index];
        if (originalSlot.type === 'text') {
          formData.append(`slots[${index}][type]`, 'text');
          if (originalSlot.fontFamily) formData.append(`slots[${index}][fontFamily]`, originalSlot.fontFamily);
          if (originalSlot.color) formData.append(`slots[${index}][color]`, originalSlot.color);
          if (originalSlot.fontSize) formData.append(`slots[${index}][fontSize]`, originalSlot.fontSize.toString());
          if (originalSlot.maxChars) formData.append(`slots[${index}][maxChars]`, originalSlot.maxChars.toString());
        } else {
          formData.append(`slots[${index}][type]`, 'photo');
        }
      });

      if (mode === 'edit' && initialFrame) {
        await frameTemplatesApi.update(initialFrame.id, formData);
        toast.success('Frame template updated successfully! 🎉');
      } else {
        await frameTemplatesApi.create(formData);
        toast.success('Frame template created successfully! 🎉');
      }
      
      router.push(redirectUrl);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template 😢. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-[#1D1D23] uppercase tracking-tight">
            Visual Frame Builder
          </h2>
          <p className="text-sm text-gray-500 font-bold mt-1">
            Map your photo coordinates dynamically!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
        
        {/* LEFT PANEL: Form Controls */}
        <div className="neobrutal-box bg-white p-6 shadow-[4px_4px_0px_#1D1D23] h-fit">
          <h3 className="text-lg font-extrabold text-[#1D1D23] mb-6 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#FF7F50]" />
            Frame Info
          </h3>

          <div className="mb-5">
            <label className="block text-sm font-black text-[#1D1D23] mb-2 uppercase tracking-wide">
              Frame Name
            </label>
            <input
              type="text"
              value={frameName}
              onChange={(e) => setFrameName(e.target.value)}
              placeholder="e.g. Classic Film Strip"
              className="w-full border-2 border-[#1D1D23] rounded-xl p-3 bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-semibold text-[#1D1D23] text-sm"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-black text-[#1D1D23] mb-2 uppercase tracking-wide">
              Upload PNG Frame
            </label>
            <div className="relative overflow-hidden w-full border-2 border-dashed border-[#1D1D23] rounded-xl p-6 bg-[#FFFDF7] text-center hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/png"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-500">
                Click or drag .png here
              </p>
            </div>
          </div>

          <hr className="border-[#1D1D23] mb-6" />

          {/* Slots List */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-[#1D1D23] uppercase text-sm">
                Slots ({slots.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddSlot('photo')}
                  disabled={!imagePreview}
                  title="Add Photo Slot"
                  className="p-1.5 bg-[#8A2BE2] text-white rounded-lg border-2 border-[#1D1D23] shadow-[2px_2px_0px_#1D1D23] hover:translate-y-px hover:shadow-[1px_1px_0px_#1D1D23] disabled:opacity-50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleAddSlot('text')}
                  disabled={!imagePreview}
                  title="Add Text Slot"
                  className="p-1.5 bg-[#FF7F50] text-[#1D1D23] rounded-lg border-2 border-[#1D1D23] shadow-[2px_2px_0px_#1D1D23] hover:translate-y-px hover:shadow-[1px_1px_0px_#1D1D23] disabled:opacity-50 transition-all font-black text-xs px-2"
                >
                  T
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {slots.length === 0 && (
                <p className="text-xs text-gray-400 font-semibold italic text-center py-2">
                  No slots added.
                </p>
              )}
              {slots.map((slot, i) => (
                <div
                  key={slot.id}
                  onClick={() => setActiveSlotId(slot.id)}
                  className={`flex items-center justify-between p-3 border-2 border-[#1D1D23] rounded-xl cursor-pointer ${
                    activeSlotId === slot.id ? 'bg-[#E0E7FF]' : 'bg-white'
                  }`}
                >
                  <span className="font-black text-sm text-[#1D1D23]">
                    {slot.type === 'text' ? 'T' : 'Slot'} {i + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 font-bold">
                      {Math.round(slot.width)}% × {Math.round(slot.height)}%
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlot(slot.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text Slot Configuration (if active slot is text) */}
          {slots.find((s) => s.id === activeSlotId)?.type === 'text' && (
            <div className="mb-6 p-4 border-2 border-[#1D1D23] rounded-xl bg-[#FFFDF7] shadow-[2px_2px_0px_#1D1D23]">
              <h4 className="font-extrabold text-[#1D1D23] uppercase text-xs mb-3">Text Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Font Family</label>
                  <select
                    value={slots.find((s) => s.id === activeSlotId)?.fontFamily || 'Inter'}
                    onChange={(e) => {
                      setSlots(slots.map(s => s.id === activeSlotId ? { ...s, fontFamily: e.target.value } : s));
                    }}
                    className="w-full border-2 border-[#1D1D23] rounded-md p-1.5 text-xs focus:ring-2 focus:ring-[#8A2BE2]"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={slots.find((s) => s.id === activeSlotId)?.color || '#000000'}
                      onChange={(e) => {
                        setSlots(slots.map(s => s.id === activeSlotId ? { ...s, color: e.target.value } : s));
                      }}
                      className="w-8 h-8 rounded border-2 border-[#1D1D23] p-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={slots.find((s) => s.id === activeSlotId)?.color || '#000000'}
                      onChange={(e) => {
                        setSlots(slots.map(s => s.id === activeSlotId ? { ...s, color: e.target.value } : s));
                      }}
                      className="flex-1 border-2 border-[#1D1D23] rounded-md p-1.5 text-xs font-mono uppercase focus:ring-2 focus:ring-[#8A2BE2]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Font Size (px)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="8"
                      max="72"
                      step="1"
                      value={slots.find((s) => s.id === activeSlotId)?.fontSize || 16}
                      onChange={(e) => {
                        setSlots(slots.map(s => s.id === activeSlotId ? { ...s, fontSize: Number(e.target.value) } : s));
                      }}
                      className="flex-1 accent-[#8A2BE2]"
                    />
                    <span className="text-xs font-black text-[#1D1D23] w-8 text-right">
                      {slots.find((s) => s.id === activeSlotId)?.fontSize || 16}px
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Max Characters</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={slots.find((s) => s.id === activeSlotId)?.maxChars || 50}
                    onChange={(e) => {
                      setSlots(slots.map(s => s.id === activeSlotId ? { ...s, maxChars: Number(e.target.value) } : s));
                    }}
                    className="w-full border-2 border-[#1D1D23] rounded-md p-1.5 text-xs focus:ring-2 focus:ring-[#8A2BE2]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Batas karakter teks yang bisa diinput user (1–500)</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!imagePreview || !frameName || slots.length === 0 || isSubmitting}
            className="neobrutal-button w-full py-4 bg-[#FF7F50] text-[#1D1D23] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Template' : 'Save Template'}
          </button>
        </div>

        {/* RIGHT PANEL: Canvas Area */}
        <div className="neobrutal-box bg-slate-50 p-6 shadow-[4px_4px_0px_#1D1D23] flex flex-col items-center justify-center relative min-h-[500px] overflow-hidden">
          {!imagePreview ? (
            <div className="text-center text-gray-400 flex flex-col items-center">
              <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-extrabold text-sm uppercase tracking-wider">
                Upload a frame first
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative shadow-xl border-4 border-[#1D1D23] bg-transparent"
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                display: 'inline-block',
                touchAction: 'none',
                containerType: 'inline-size',
              }}
            >
              <img
                src={imagePreview}
                alt="Frame Template"
                className="max-h-[65vh] w-auto pointer-events-none select-none block"
              />

              {slots.map((slot, index) => {
                const isActive = activeSlotId === slot.id;
                return (
                  <div
                    key={slot.id}
                    onPointerDown={(e) => handlePointerDown(e, slot, 'drag')}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                    className={`absolute flex items-center justify-center cursor-move border-2 ${
                      isActive
                        ? 'border-[#FF7F50] bg-[#FF7F50]/20 z-20'
                        : 'border-blue-500 bg-blue-500/10 z-10 hover:border-blue-400'
                    }`}
                  >
                    {slot.type === 'text' ? (
                      <div
                        className="w-full h-full flex items-center justify-center overflow-hidden p-1"
                        style={{
                          fontFamily: slot.fontFamily || 'Inter',
                          color: slot.color || '#000000',
                          fontSize: slot.fontSize ? `${(slot.fontSize / 400) * 100}cqw` : '6cqw',
                        }}
                      >
                        <span className="truncate w-full text-center font-bold">Custom Text</span>
                      </div>
                    ) : (
                      <span
                        className={`font-black text-sm select-none ${
                          isActive ? 'text-[#FF7F50]' : 'text-blue-600'
                        }`}
                        style={{ textShadow: '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff' }}
                      >
                        SLOT {index + 1}
                      </span>
                    )}

                    {isActive && (
                      <>
                        <div onPointerDown={(e) => handlePointerDown(e, slot, 'resize', 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#FF7F50] border border-white rounded-full cursor-nwse-resize z-30 shadow-sm" />
                        <div onPointerDown={(e) => handlePointerDown(e, slot, 'resize', 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#FF7F50] border border-white rounded-full cursor-nesw-resize z-30 shadow-sm" />
                        <div onPointerDown={(e) => handlePointerDown(e, slot, 'resize', 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#FF7F50] border border-white rounded-full cursor-nesw-resize z-30 shadow-sm" />
                        <div onPointerDown={(e) => handlePointerDown(e, slot, 'resize', 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#FF7F50] border border-white rounded-full cursor-nwse-resize z-30 shadow-sm" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
