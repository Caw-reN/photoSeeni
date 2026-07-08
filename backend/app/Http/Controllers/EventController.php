<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\FrameTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class EventController extends Controller
{
    /**
     * List all events (admin only).
     */
    public function index(Request $request)
    {
        $query = Event::with(['creator', 'frameTemplate'])
            ->withCount(['packages', 'redeemCodes', 'photoSessions']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('organizer_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json($query->latest()->paginate(15));
    }

    /**
     * Show a public event page by slug (for package purchase).
     */
    public function show(string $slug)
    {
        $event = Event::with(['packages' => function ($q) {
            $q->where('is_active', true)->orderBy('sort_order')->with('frameTemplate');
        }, 'frameTemplate'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        if ($event->isExpired()) {
            return response()->json(['message' => 'Event ini sudah berakhir.'], 410);
        }

        return response()->json($event);
    }

    /**
     * Show single event details (admin only).
     */
    public function adminShow(Event $event)
    {
        return response()->json($event->load(['creator', 'frameTemplate', 'packages']));
    }

    /**
     * Create a new event (admin only).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'organizer_name'    => 'required|string|max:255',
            'description'       => 'nullable|string',
            'location'          => 'nullable|string|max:255',
            'event_date'        => 'nullable|date',
            'frame_template_id' => 'nullable|exists:frame_templates,id',
            'is_active'         => 'boolean',
            'expires_at'        => 'nullable|date',
        ]);

        // Auto-generate slug from name, ensure uniqueness
        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $i = 1;
        while (Event::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $i++;
        }

        $event = Event::create(array_merge($validated, [
            'slug'       => $slug,
            'created_by' => $request->user()->id,
        ]));

        return response()->json($event->load(['creator', 'frameTemplate', 'packages']), 201);
    }

    /**
     * Update an event (admin only).
     */
    public function update(Request $request, Event $event)
    {
        $validated = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'organizer_name'    => 'sometimes|string|max:255',
            'description'       => 'nullable|string',
            'location'          => 'nullable|string|max:255',
            'event_date'        => 'nullable|date',
            'frame_template_id' => 'nullable|exists:frame_templates,id',
            'is_active'         => 'sometimes|boolean',
            'expires_at'        => 'nullable|date',
        ]);

        $event->update($validated);

        return response()->json($event->load(['creator', 'frameTemplate', 'packages']));
    }

    /**
     * Delete an event (admin only).
     */
    public function destroy(Event $event)
    {
        $event->delete();
        return response()->json(['message' => 'Event berhasil dihapus.']);
    }

    /**
     * Event statistics (admin only).
     */
    public function stats(Event $event)
    {
        $totalCodes    = $event->redeemCodes()->count();
        $paidCodes     = $event->redeemCodes()->where('payment_status', 'paid')->count();
        $usedCodes     = $event->redeemCodes()->where('is_used', true)->count();
        $pendingCodes  = $event->redeemCodes()->where('payment_status', 'pending')->count();
        $revenue       = $event->redeemCodes()->where('payment_status', 'paid')->sum('payment_amount');
        $completedSessions = $event->photoSessions()->where('status', 'completed')->count();

        return response()->json([
            'total_codes'        => $totalCodes,
            'paid_codes'         => $paidCodes,
            'used_codes'         => $usedCodes,
            'pending_codes'      => $pendingCodes,
            'unused_paid_codes'  => $paidCodes - $usedCodes,
            'revenue'            => (float) $revenue,
            'completed_sessions' => $completedSessions,
        ]);
    }
}
