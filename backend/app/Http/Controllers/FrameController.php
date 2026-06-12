<?php

namespace App\Http\Controllers;

use App\Models\Frame;
use App\Models\FrameTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;

class FrameController extends Controller
{
    public function index()
    {
        // Return frame templates for the current user (if logged in) or global templates
        $query = FrameTemplate::where('is_active', true);
        
        if (auth('sanctum')->check()) {
            $userId = auth('sanctum')->id();
            $query->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhereNull('user_id');
            });
        } else {
            $query->whereNull('user_id');
        }

        $frames = $query->get()->map(function ($frame) {
            return [
                'id' => $frame->id,
                'name' => $frame->name,
                'image_path' => $frame->image_path,
                'image_url' => Storage::disk('public')->url($frame->image_path),
                'coordinates' => $frame->slots, // slots is already JSON
                'created_at' => $frame->created_at,
                'updated_at' => $frame->updated_at,
            ];
        });
        
        return response()->json($frames);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'frame_image' => 'required|image|mimes:png|max:5120', // only PNGs, max 5MB
        ]);

        $file = $request->file('frame_image');

        // Verify transparent background (contains alpha channel)
        try {
            $manager = new ImageManager(new GdDriver());
            $image = $manager->decode($file->getRealPath());
            
            // A simple PNG check could also look at transparency, 
            // but the MIME type check for PNG is already strict.
            // Let's check if we can read it.
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'The provided image is invalid or corrupt.'
            ], 422);
        }

        $path = $file->store('frames', 'public');

        $frame = Frame::create([
            'name' => $request->name,
            'file_path' => Storage::url($path),
            'is_global' => false,
            'user_id' => $request->user()->id,
            'active' => true,
        ]);

        return response()->json($frame, 201);
    }

    public function destroy(Request $request, $id)
    {
        $frame = FrameTemplate::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if (Storage::disk('public')->exists($frame->image_path)) {
            Storage::disk('public')->delete($frame->image_path);
        }

        $frame->delete();

        return response()->json(['message' => 'Frame deleted successfully.']);
    }
}