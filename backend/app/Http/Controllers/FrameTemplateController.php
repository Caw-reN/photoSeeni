<?php

namespace App\Http\Controllers;

use App\Models\FrameTemplate;
use Illuminate\Http\Request;
use App\Http\Requests\StoreFrameTemplateRequest;
use App\Http\Requests\UpdateFrameTemplateRequest;
use Illuminate\Support\Facades\Storage;

class FrameTemplateController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $templates = FrameTemplate::with('user')->latest()->get();
        
        // Map to append the full storage URL to image_path
        $templates->transform(function ($template) {
            $template->image_url = Storage::disk('public')->url($template->image_path);
            return $template;
        });

        return response()->json([
            'message' => 'Frame templates retrieved successfully.',
            'data' => $templates
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreFrameTemplateRequest $request)
    {
        $validated = $request->validated();

        $path = $request->file('image')->store('frame_templates', 'public');

        $template = FrameTemplate::create([
            'user_id' => $request->user() ? $request->user()->id : null,
            'name' => $validated['name'],
            'image_path' => $path,
            'slots' => $validated['slots'],
            'is_active' => true,
        ]);

        $template->image_url = Storage::disk('public')->url($template->image_path);

        return response()->json([
            'message' => 'Frame template created successfully.',
            'data' => $template
        ], 201);
    }

    public function toggleActive(FrameTemplate $frameTemplate)
    {
        $frameTemplate->is_active = !$frameTemplate->is_active;
        $frameTemplate->save();

        return response()->json([
            'message' => 'Template status updated.',
            'data' => $frameTemplate
        ]);
    }

    public function toggleBw(FrameTemplate $frameTemplate)
    {
        $frameTemplate->is_bw = !$frameTemplate->is_bw;
        $frameTemplate->save();

        return response()->json([
            'message' => 'Template B&W status updated.',
            'data' => $frameTemplate
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(FrameTemplate $frameTemplate)
    {
        $frameTemplate->image_url = Storage::disk('public')->url($frameTemplate->image_path);

        return response()->json([
            'message' => 'Frame template retrieved successfully.',
            'data' => $frameTemplate
        ], 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateFrameTemplateRequest $request, FrameTemplate $frameTemplate)
    {
        $validated = $request->validated();

        if ($request->hasFile('image')) {
            // Delete old image
            if (Storage::disk('public')->exists($frameTemplate->image_path)) {
                Storage::disk('public')->delete($frameTemplate->image_path);
            }
            $path = $request->file('image')->store('frame_templates', 'public');
            $frameTemplate->image_path = $path;
        }

        if (isset($validated['name'])) {
            $frameTemplate->name = $validated['name'];
        }

        if (isset($validated['slots'])) {
            $frameTemplate->slots = $validated['slots'];
        }

        $frameTemplate->save();

        $frameTemplate->image_url = Storage::disk('public')->url($frameTemplate->image_path);

        return response()->json([
            'message' => 'Frame template updated successfully.',
            'data' => $frameTemplate
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(FrameTemplate $frameTemplate)
    {
        if (Storage::disk('public')->exists($frameTemplate->image_path)) {
            Storage::disk('public')->delete($frameTemplate->image_path);
        }

        $frameTemplate->delete();

        return response()->json([
            'message' => 'Frame template deleted successfully.'
        ], 200);
    }

    public function streamImage($id)
    {
        $template = FrameTemplate::findOrFail($id);
        $path = Storage::disk('public')->path($template->image_path);
        if (!file_exists($path)) {
            abort(404);
        }

        $mimeType = mime_content_type($path) ?: 'image/png';

        return response()->file($path, [
            'Content-Type'                => $mimeType,
            'Cache-Control'               => 'public, max-age=86400',
            'Access-Control-Allow-Origin' => '*',
            'ngrok-skip-browser-warning'  => '69420',
        ]);
    }
}