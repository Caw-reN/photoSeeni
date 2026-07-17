<?php

namespace App\Http\Controllers;

use App\Models\Frame;
use App\Models\Photo;
use App\Models\PhotoSession;
use App\Models\EventRedeemCode;
use Illuminate\Http\Request;
use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;

class PhotoSessionController extends Controller
{
    private const MAX_SLOTS = 10;
    private const STRIP_WIDTH = 600;
    private const PHOTO_HEIGHT = 450;
    private const PADDING = 12;

    public function index(Request $request)
    {
        $sessions = $request->user()
            ->photoSessions()
            ->with(['frame', 'photos'])
            ->where('status', 'completed')
            ->latest()
            ->paginate(12);

        return response()->json($sessions);
    }

    public function store(Request $request)
    {
        // Block regular session creation if admin has disabled it (e.g. during a live event)
        if (Setting::getValue('regular_sessions_enabled', 'true') === 'false') {
            return response()->json([
                'message' => 'Sesi reguler sedang dinonaktifkan sementara karena ada event yang sedang berlangsung. Silakan gunakan kode redeem dari event Anda.',
                'disabled' => true,
            ], 403);
        }

        $request->validate([
            'frame_id' => 'nullable|exists:frame_templates,id',
        ]);

        $session = PhotoSession::create([
            'user_id' => $request->user()?->id,
            'frame_id' => $request->frame_id,
            'status' => 'active',
        ]);

        return response()->json($session->load(['frame', 'photos']), 201);
    }

    /**
     * Resolve a session by UUID (new) or integer ID (legacy backward compat).
     * This allows old QR codes with integer IDs to keep working.
     */
    private function resolveSession(string $identifier): PhotoSession
    {
        // If it looks like an integer, try ID lookup first (legacy)
        if (ctype_digit($identifier)) {
            return PhotoSession::findOrFail((int) $identifier);
        }

        // Otherwise treat as UUID
        return PhotoSession::where('uuid', $identifier)->firstOrFail();
    }

    public function uploadPhoto(Request $request, $sessionId)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,jpg,png|max:8192',
            'slot_index' => 'required|integer|min:0|max:' . (self::MAX_SLOTS - 1),
        ]);

        $session = $this->findEditableSession($sessionId, $request->user());

        // Remove any existing photo for this slot
        $existingPhoto = Photo::where('photo_session_id', $session->id)
            ->where('slot_index', $request->slot_index)
            ->first();

        if ($existingPhoto) {
            Storage::disk('public')->delete($existingPhoto->file_path);
            $existingPhoto->delete();
        }

        $path = $request->file('photo')->store("sessions/{$session->id}", 'public');

        $photo = Photo::create([
            'photo_session_id' => $session->id,
            'slot_index' => $request->slot_index,
            'file_path' => $path,
        ]);

        return response()->json([
            'photo' => array_merge($photo->toArray(), [
                'url' => Storage::disk('public')->url($photo->file_path),
            ]),
            'session' => $session->load('photos'),
        ], 201);
    }

    public function complete(Request $request, $sessionId)
    {
        $session = $this->resolveSession($sessionId);

        // Security check
        if ($session->user_id) {
            if (!$request->user() || $session->user_id !== $request->user()->id) {
                abort(403, 'Unauthorized');
            }
        }

        // Allow completing/updating if it is active or completed
        if ($session->status !== 'active' && $session->status !== 'completed') {
            abort(422, 'Session is not in active or completed status.');
        }
        
        if ($request->has('frame_id')) {
            $session->update(['frame_id' => $request->frame_id]);
            $session->load('frame');
        }

        if ($request->has('gif_speed')) {
            $session->update(['gif_speed' => (int) $request->gif_speed]);
        }

        if ($request->has('custom_texts')) {
            $session->update(['custom_texts' => $request->input('custom_texts')]);
        }

        $photos = $session->photos()->orderBy('slot_index')->get();

        if ($photos->count() < 1) {
            return response()->json([
                'message' => 'At least one photo is required before completing the session.'
            ], 422);
        }

        if ($request->hasFile('final_strips')) {
            $paths = [];
            foreach ($request->file('final_strips') as $index => $file) {
                $paths[] = $file->store("sessions/{$session->id}", 'public');
            }
            
            if ($session->final_image_paths) {
                foreach ($session->final_image_paths as $oldPath) {
                    Storage::disk('public')->delete($oldPath);
                }
            } elseif ($session->final_image_path) {
                Storage::disk('public')->delete($session->final_image_path);
            }
            
            $updateData = [
                'status' => 'completed',
                'final_image_path' => count($paths) > 0 ? $paths[0] : null,
                'final_image_paths' => $paths,
            ];
            
            $session->update($updateData);

            // If this is an event session, send result notification to buyer
            $this->maybeNotifyEventResult($session);

            return response()->json([
                'session' => $session->load(['frame', 'photos']),
                'final_image_url' => count($paths) > 0 ? Storage::disk('public')->url($paths[0]) : null,
                'final_image_urls' => array_map(fn($p) => Storage::disk('public')->url($p), $paths),
            ]);
        }

        if ($request->hasFile('final_strip')) {
            $path = $request->file('final_strip')->store("sessions/{$session->id}", 'public');
            if ($session->final_image_path) {
                Storage::disk('public')->delete($session->final_image_path);
            }
            
            $updateData = [
                'status' => 'completed',
                'final_image_path' => $path,
                'final_image_paths' => [$path],
            ];
            
            $session->update($updateData);

            // If this is an event session, send result notification to buyer
            $this->maybeNotifyEventResult($session);

            return response()->json([
                'session' => $session->load(['frame', 'photos']),
                'final_image_url' => Storage::disk('public')->url($path),
                'final_image_urls' => [Storage::disk('public')->url($path)],
            ]);
        }

        // Composite photos into a strip if not already done
        if (!$session->final_image_path) {
            $finalPath = $this->compositeStrip($session, $photos);
            $session->update([
                'status' => 'completed',
                'final_image_path' => $finalPath,
                'final_image_paths' => [$finalPath],
            ]);
        }

        // If this is an event session, send result notification to buyer
        $this->maybeNotifyEventResult($session);

        return response()->json([
            'session' => $session->load(['frame', 'photos']),
            'final_image_url' => Storage::disk('public')->url($session->final_image_path),
            'final_image_urls' => $session->final_image_paths ? array_map(fn($p) => Storage::disk('public')->url($p), $session->final_image_paths) : [Storage::disk('public')->url($session->final_image_path)],
        ]);
    }

    /**
     * If the session is tied to an event redeem code, send the result link notification.
     */
    private function maybeNotifyEventResult(PhotoSession $session): void
    {
        if (!$session->event_redeem_code_id) return;

        $redeemCode = EventRedeemCode::with('event')->find($session->event_redeem_code_id);
        if ($redeemCode && !$redeemCode->result_notified_at) {
            $controller = new EventRedeemController();
            $controller->sendResultNotification($redeemCode);
        }
    }

    public function show($sessionId)
    {
        $session = PhotoSession::with(['frame', 'photos', 'event'])
            ->where(function ($q) use ($sessionId) {
                if (ctype_digit((string) $sessionId)) {
                    $q->where('id', (int) $sessionId);
                } else {
                    $q->where('uuid', $sessionId);
                }
            })
            ->firstOrFail();

        $responseData = $session->toArray();
        if ($session->final_image_paths && is_array($session->final_image_paths)) {
            $responseData['final_image_urls'] = array_map(fn($p) => Storage::disk('public')->url($p), $session->final_image_paths);
        } elseif ($session->final_image_path) {
            $responseData['final_image_urls'] = [Storage::disk('public')->url($session->final_image_path)];
        }
        if ($session->final_image_path) {
            $responseData['final_image_url'] = Storage::disk('public')->url($session->final_image_path);
        }
        foreach ($responseData['photos'] as &$photo) {
            $photo['url'] = Storage::disk('public')->url($photo['file_path']);
        }
        // Inject image_url for the frame so frontend can display it directly
        if ($session->frame && $session->frame->image_path) {
            $responseData['frame']['image_url'] = Storage::disk('public')->url($session->frame->image_path);
        }

        return response()->json($responseData);
    }

    public function destroy(Request $request, $sessionId)
    {
        $session = $this->resolveSession($sessionId);

        if ($session->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized');
        }

        // Delete associated photos from storage
        foreach ($session->photos as $photo) {
            Storage::disk('public')->delete($photo->file_path);
        }

        if ($session->final_image_paths) {
            foreach ($session->final_image_paths as $path) {
                Storage::disk('public')->delete($path);
            }
        } elseif ($session->final_image_path) {
            Storage::disk('public')->delete($session->final_image_path);
        }

        $session->delete();

        return response()->json(['message' => 'Session deleted successfully.']);
    }

    private function findEditableSession($sessionId, $user)
    {
        // Dual lookup: UUID (new) or integer ID (legacy)
        $session = PhotoSession::where('status', 'active')
            ->where(function ($q) use ($sessionId) {
                if (ctype_digit((string) $sessionId)) {
                    $q->where('id', (int) $sessionId);
                } else {
                    $q->where('uuid', $sessionId);
                }
            })
            ->firstOrFail();

        if ($session->user_id) {
            if (!$user || $session->user_id !== $user->id) {
                abort(403, 'Unauthorized');
            }
        }

        return $session;
    }

    private function compositeStrip(PhotoSession $session, $photos): string
    {
        $manager = new ImageManager(new GdDriver());

        $photoCount = $photos->count();
        $totalHeight = (self::PHOTO_HEIGHT * $photoCount)
            + (self::PADDING * ($photoCount + 1));

        // Create the white canvas strip
        $canvas = $manager->createImage(self::STRIP_WIDTH, $totalHeight)->fill('#FFFFFF');

        foreach ($photos as $photo) {
            $photoImage = $manager->decode(Storage::disk('public')->path($photo->file_path));
            $photoImage->cover(
                self::STRIP_WIDTH - (2 * self::PADDING),
                self::PHOTO_HEIGHT
            );

            $x = self::PADDING;
            $y = self::PADDING + ($photo->slot_index * (self::PHOTO_HEIGHT + self::PADDING));

            $canvas->insert($photoImage, $x, $y);
        }

        // Overlay the frame on top if one is selected
        if ($session->frame && $session->frame->image_path) {
            try {
                $framePath = Storage::disk('public')->path($session->frame->image_path);
                if (file_exists($framePath)) {
                    $frameImage = $manager->decode($framePath);
                    $frameImage->resize(self::STRIP_WIDTH, $totalHeight);
                    $canvas->insert($frameImage, 0, 0);
                }
            } catch (\Exception $e) {
                // Continue without frame overlay if it fails
            }
        }

        $finalPath = "sessions/{$session->id}/final_strip.jpg";
        $canvas->save(Storage::disk('public')->path($finalPath));

        return $finalPath;
    }

    /**
     * Initiate a Paymenku payment transaction for the session.
     */
    public function initiatePayment(Request $request, $sessionId)
    {
        $session = $this->resolveSession($sessionId);

        // Security check
        if ($session->user_id && (!auth()->check() || $session->user_id !== auth()->id())) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Update frame_id if provided
        if ($request->has('frame_id')) {
            $request->validate([
                'frame_id' => 'nullable|exists:frame_templates,id',
            ]);
            $session->update(['frame_id' => $request->frame_id]);
        }

        $apiKey = Setting::getValue('paymentku_api_key');
        if (!$apiKey) {
            return response()->json(['message' => 'Paymentku API Key is not configured.'], 500);
        }

        $basePrice = (int) Setting::getValue('session_price', '25000');
        $serviceFee = (int) Setting::getValue('service_fee', '1500');
        $amount = $basePrice + $serviceFee;
        $referenceId = 'TRX-SESS-' . $session->id . '-' . time();
        $customerName = $session->user ? $session->user->name : 'SnapJoy Guest';
        $customerEmail = $session->user ? $session->user->email : 'guest@snapjoy.com';
        $returnUrl = $request->get('return_url', url('/result/' . $session->id));

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'Idempotency-Key' => $referenceId,
            ])->post('https://paymenku.com/api/v1/transaction/create', [
                'channel_code' => 'qris',
                'amount' => $amount,
                'reference_id' => $referenceId,
                'customer_name' => $customerName,
                'customer_email' => $customerEmail,
                'return_url' => $returnUrl,
            ]);

            if ($response->failed()) {
                $errData = $response->json();
                return response()->json([
                    'message' => $errData['message'] ?? 'Failed to initiate transaction with Paymenku.'
                ], $response->status());
            }

            $resData = $response->json();
            
            if ($resData['status'] === 'success') {
                $data = $resData['data'];
                $session->update([
                    'payment_status' => 'pending',
                    'payment_trx_id' => $data['trx_id'],
                    'payment_reference_id' => $referenceId,
                    'payment_qr_url' => $data['payment_info']['qr_url'] ?? null,
                    'payment_qr_string' => $data['payment_info']['qr_string'] ?? null,
                    'payment_amount' => $data['amount'] ?? $amount,
                ]);

                return response()->json([
                    'status' => 'success',
                    'session' => $session->load(['frame', 'photos']),
                    'payment_info' => $data['payment_info'] ?? null,
                ]);
            }

            return response()->json([
                'message' => $resData['message'] ?? 'Paymenku returned an unsuccessful status.'
            ], 422);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Payment initiation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check current Paymenku payment status of the session.
     */
    public function checkPaymentStatus(Request $request, $sessionId)
    {
        $session = $this->resolveSession($sessionId);

        // Security check
        if ($session->user_id && (!auth()->check() || $session->user_id !== auth()->id())) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($session->payment_status === 'paid') {
            $responseData = $session->toArray();
            if ($session->final_image_paths && is_array($session->final_image_paths)) {
                $responseData['final_image_urls'] = array_map(fn($p) => Storage::disk('public')->url($p), $session->final_image_paths);
            } elseif ($session->final_image_path) {
                $responseData['final_image_urls'] = [Storage::disk('public')->url($session->final_image_path)];
            }
            if ($session->final_image_path) {
                $responseData['final_image_url'] = Storage::disk('public')->url($session->final_image_path);
            }
            return response()->json($responseData);
        }

        if ($session->payment_status === 'pending' && $session->payment_reference_id) {
            $apiKey = Setting::getValue('paymentku_api_key');
            if ($apiKey) {
                try {
                    $response = Http::withHeaders([
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Accept' => 'application/json',
                    ])->get('https://paymenku.com/api/v1/check-status/' . $session->payment_reference_id);

                    if ($response->successful()) {
                        $resData = $response->json();
                        if ($resData['status'] === 'success') {
                            $payStatus = $resData['data']['status']; // pending, paid, expired, cancelled

                            if ($payStatus === 'paid' && $session->payment_status !== 'paid') {
                                $session->payment_status = 'paid';
                                $session->payment_paid_at = now();

                                // Composite photos into strip if not already done
                                if (!$session->final_image_path) {
                                    $photos = $session->photos()->orderBy('slot_index')->get();
                                    if ($photos->count() >= 1) {
                                        $finalPath = $this->compositeStrip($session, $photos);
                                        $session->status = 'completed';
                                        $session->final_image_path = $finalPath;
                                        $session->final_image_paths = [$finalPath];
                                    }
                                }
                                $session->save();
                            } elseif ($payStatus !== 'pending' && $payStatus !== 'paid') {
                                $session->payment_status = $payStatus;
                                $session->save();
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // Fail silently and return cached database status on network/api error
                }
            }
        }

        $responseData = $session->toArray();
        if ($session->final_image_paths && is_array($session->final_image_paths)) {
            $responseData['final_image_urls'] = array_map(fn($p) => Storage::disk('public')->url($p), $session->final_image_paths);
        } elseif ($session->final_image_path) {
            $responseData['final_image_urls'] = [Storage::disk('public')->url($session->final_image_path)];
        }
        if ($session->final_image_path) {
            $responseData['final_image_url'] = Storage::disk('public')->url($session->final_image_path);
        }
        return response()->json($responseData);
    }

    /**
     * Public webhook callback endpoint for Paymenku.
     */
    public function handleWebhook(Request $request)
    {
        $payload = $request->getContent();
        $timestamp = $request->header('X-PaymenKu-Timestamp', '');
        $signature = $request->header('X-PaymenKu-Signature', '');
        
        $webhookSecret = Setting::getValue('webhook_token');
        if (!$webhookSecret) {
            return response()->json(['error' => 'Webhook secret not configured'], 500);
        }

        $computedSignature = hash_hmac('sha256', $timestamp . '.' . $payload, $webhookSecret);

        if (!hash_equals($computedSignature, $signature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $data = json_decode($payload, true);
        if (!$data || !isset($data['reference_id'])) {
            return response()->json(['error' => 'Invalid payload'], 400);
        }

        $referenceId = $data['reference_id'];
        $status = $data['status']; // paid, failed, expired, cancelled, refunded

        $session = PhotoSession::where('payment_reference_id', $referenceId)->first();

        if ($session) {
            if ($status === 'paid' && $session->payment_status !== 'paid') {
                $session->payment_status = 'paid';
                $session->payment_paid_at = now();

                // Composite photos into strip if not already done
                if (!$session->final_image_path) {
                    $photos = $session->photos()->orderBy('slot_index')->get();
                    if ($photos->count() >= 1) {
                        $finalPath = $this->compositeStrip($session, $photos);
                        $session->status = 'completed';
                        $session->final_image_path = $finalPath;
                        $session->final_image_paths = [$finalPath];
                    }
                }
                $session->save();
            } elseif ($status !== 'paid' && $status !== 'pending') {
                $session->payment_status = $status;
                $session->save();
            }

            return response()->json(['received' => true], 200);
        }

        return response()->json(['error' => 'Session not found'], 404);
    }

    public function downloadStrip($sessionId)
    {
        $session = $this->resolveSession($sessionId);
        if (!$session->final_image_path) {
            abort(404, 'Photo strip not ready');
        }
        $path = Storage::disk('public')->path($session->final_image_path);
        if (!file_exists($path)) {
            abort(404, 'File not found');
        }
        return response()->download($path, 'snapjoy-strip-' . $session->id . '.jpg');
    }

    public function downloadPhoto($photoId)
    {
        $photo = Photo::findOrFail($photoId);
        $path = Storage::disk('public')->path($photo->file_path);
        if (!file_exists($path)) {
            abort(404, 'File not found');
        }
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        return response()->download($path, 'snapjoy-raw-' . $photo->photo_session_id . '-' . ($photo->slot_index + 1) . '.' . $extension);
    }
}