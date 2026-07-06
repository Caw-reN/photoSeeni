<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventPackage;
use Illuminate\Http\Request;

class EventPackageController extends Controller
{
    /**
     * List active packages for a given event (public).
     */
    public function index(string $slug)
    {
        $event = Event::where('slug', $slug)->where('is_active', true)->firstOrFail();

        $packages = $event->packages()
            ->where('is_active', true)
            ->with('frameTemplate')
            ->orderBy('sort_order')
            ->get();

        return response()->json($packages);
    }

    /**
     * Create a new package for an event (admin only).
     */
    public function store(Request $request, Event $event)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'description'       => 'nullable|string',
            'price'             => 'required|integer|min:0',
            'photo_count'       => 'required|integer|min:1|max:20',
            'frame_template_id' => 'nullable|exists:frame_templates,id',
            'is_active'         => 'boolean',
            'sort_order'        => 'integer',
        ]);

        $package = $event->packages()->create($validated);

        return response()->json($package->load('frameTemplate'), 201);
    }

    /**
     * Update an existing package (admin only). Price is fully dynamic.
     */
    public function update(Request $request, Event $event, EventPackage $package)
    {
        abort_if($package->event_id !== $event->id, 404);

        $validated = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'description'       => 'nullable|string',
            'price'             => 'sometimes|integer|min:0',
            'photo_count'       => 'sometimes|integer|min:1|max:20',
            'frame_template_id' => 'nullable|exists:frame_templates,id',
            'is_active'         => 'sometimes|boolean',
            'sort_order'        => 'sometimes|integer',
        ]);

        $package->update($validated);

        return response()->json($package->load('frameTemplate'));
    }

    /**
     * Delete a package (admin only).
     */
    public function destroy(Event $event, EventPackage $package)
    {
        abort_if($package->event_id !== $event->id, 404);
        $package->delete();

        return response()->json(['message' => 'Paket berhasil dihapus.']);
    }
}
