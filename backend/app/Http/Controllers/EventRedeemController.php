<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventPackage;
use App\Models\EventRedeemCode;
use App\Models\PhotoSession;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class EventRedeemController extends Controller
{
    /**
     * PUBLIC: Purchase a package for an event.
     * Creates a redeem code and initiates QRIS payment via Paymenku.
     */
    public function purchase(Request $request, string $slug)
    {
        $event = Event::where('slug', $slug)->where('is_active', true)->firstOrFail();

        if ($event->isExpired()) {
            return response()->json(['message' => 'Event ini sudah berakhir.'], 410);
        }

        $request->validate([
            'event_package_id' => 'required|exists:event_packages,id',
            'buyer_name'       => 'required|string|max:255',
            'buyer_email'      => 'nullable|email|max:255',
            'buyer_phone'      => 'nullable|string|max:20',
        ]);

        // Validate package belongs to this event
        $package = EventPackage::where('id', $request->event_package_id)
            ->where('event_id', $event->id)
            ->where('is_active', true)
            ->firstOrFail();

        // Require at least email or phone
        if (!$request->buyer_email && !$request->buyer_phone) {
            return response()->json(['message' => 'Email atau nomor WhatsApp wajib diisi untuk mengirim hasil foto.'], 422);
        }

        // Generate unique redeem code
        $code = EventRedeemCode::generateCode($event);

        $redeemCode = EventRedeemCode::create([
            'event_id'         => $event->id,
            'event_package_id' => $package->id,
            'code'             => $code,
            'buyer_name'       => $request->buyer_name,
            'buyer_email'      => $request->buyer_email,
            'buyer_phone'      => $request->buyer_phone,
            'payment_status'   => 'unpaid',
            'payment_amount'   => $package->price,
        ]);

        // Initiate QRIS payment via Paymenku
        $apiKey = Setting::getValue('paymentku_api_key');
        if (!$apiKey) {
            return response()->json(['message' => 'Sistem pembayaran belum dikonfigurasi. Hubungi admin.'], 500);
        }

        $referenceId  = 'EVT-' . $redeemCode->id . '-' . time();
        $returnUrl    = $request->get('return_url', url('/event/' . $slug . '/success?code=' . $code));

        try {
            $response = Http::withHeaders([
                'Authorization'  => 'Bearer ' . $apiKey,
                'Content-Type'   => 'application/json',
                'Accept'         => 'application/json',
                'Idempotency-Key' => $referenceId,
            ])->post('https://paymenku.com/api/v1/transaction/create', [
                'channel_code'   => 'qris',
                'amount'         => $package->price,
                'reference_id'   => $referenceId,
                'customer_name'  => $request->buyer_name,
                'customer_email' => $request->buyer_email ?? 'guest@fotoseeni.com',
                'return_url'     => $returnUrl,
            ]);

            if ($response->failed()) {
                $redeemCode->delete();
                return response()->json([
                    'message' => $response->json('message') ?? 'Gagal membuat transaksi pembayaran.',
                ], $response->status());
            }

            $resData = $response->json();
            if ($resData['status'] === 'success') {
                $data = $resData['data'];
                $redeemCode->update([
                    'payment_status'       => 'pending',
                    'payment_trx_id'       => $data['trx_id'],
                    'payment_reference_id' => $referenceId,
                    'payment_qr_url'       => $data['payment_info']['qr_url'] ?? null,
                    'payment_qr_string'    => $data['payment_info']['qr_string'] ?? null,
                    'payment_amount'       => $data['amount'] ?? $package->price,
                ]);

                return response()->json([
                    'status'       => 'success',
                    'code'         => $redeemCode->code,
                    'redeem_id'    => $redeemCode->id,
                    'payment_info' => $data['payment_info'] ?? null,
                    'package'      => $package,
                    'event'        => $event->only(['name', 'slug', 'organizer_name']),
                ]);
            }

            $redeemCode->delete();
            return response()->json(['message' => $resData['message'] ?? 'Gagal memulai pembayaran.'], 422);

        } catch (\Exception $e) {
            $redeemCode->delete();
            return response()->json(['message' => 'Gagal menghubungi sistem pembayaran: ' . $e->getMessage()], 500);
        }
    }

    /**
     * PUBLIC: Check payment status for a redeem code purchase.
     */
    public function checkPurchaseStatus(Request $request)
    {
        $request->validate(['code' => 'required|string']);

        $redeemCode = EventRedeemCode::with(['event', 'package'])
            ->where('code', $request->code)
            ->firstOrFail();

        // If already paid, return immediately
        if ($redeemCode->payment_status === 'paid') {
            return response()->json($redeemCode);
        }

        // Poll Paymenku if pending
        if ($redeemCode->payment_status === 'pending' && $redeemCode->payment_reference_id) {
            $apiKey = Setting::getValue('paymentku_api_key');
            if ($apiKey) {
                try {
                    $response = Http::withHeaders([
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Accept'        => 'application/json',
                    ])->get('https://paymenku.com/api/v1/check-status/' . $redeemCode->payment_reference_id);

                    if ($response->successful()) {
                        $resData = $response->json();
                        if ($resData['status'] === 'success') {
                            $payStatus = $resData['data']['status'];
                            if ($payStatus === 'paid') {
                                $redeemCode->update([
                                    'payment_status'  => 'paid',
                                    'payment_paid_at' => now(),
                                ]);
                            } elseif (!in_array($payStatus, ['paid', 'pending'])) {
                                $redeemCode->update(['payment_status' => $payStatus]);
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // Fail silently
                }
            }
        }

        return response()->json($redeemCode->fresh(['event', 'package']));
    }

    /**
     * PUBLIC: Webhook from Paymenku for event package purchases.
     */
    public function paymentWebhook(Request $request)
    {
        $payload   = $request->getContent();
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
        $status      = $data['status'];

        // Only process EVT- prefixed reference IDs
        if (!str_starts_with($referenceId, 'EVT-')) {
            return response()->json(['received' => true]);
        }

        $redeemCode = EventRedeemCode::where('payment_reference_id', $referenceId)->first();

        if ($redeemCode && $status === 'paid' && $redeemCode->payment_status !== 'paid') {
            $redeemCode->update([
                'payment_status'  => 'paid',
                'payment_paid_at' => now(),
            ]);
        } elseif ($redeemCode && !in_array($status, ['paid', 'pending'])) {
            $redeemCode->update(['payment_status' => $status]);
        }

        return response()->json(['received' => true]);
    }

    /**
     * PUBLIC: Validate a redeem code before starting a photoshoot session.
     * Returns code status: valid (unused), already_used (has result), invalid, expired.
     */
    public function validate(Request $request)
    {
        $request->validate(['code' => 'required|string']);

        $redeemCode = EventRedeemCode::with(['event.frameTemplates', 'event.frameTemplate', 'package', 'photoSession'])
            ->where('code', strtoupper(trim($request->code)))
            ->first();

        if (!$redeemCode) {
            return response()->json(['status' => 'invalid', 'message' => 'Kode redeem tidak ditemukan.'], 404);
        }

        if ($redeemCode->payment_status !== 'paid') {
            return response()->json([
                'status'  => 'unpaid',
                'message' => 'Kode ini belum dibayar. Selesaikan pembayaran terlebih dahulu.',
            ], 402);
        }

        if ($redeemCode->event->isExpired() || !$redeemCode->event->is_active) {
            return response()->json(['status' => 'expired', 'message' => 'Event ini sudah berakhir.'], 410);
        }

        if ($redeemCode->is_used) {
            // Code is used — return result info so frontend can redirect
            return response()->json([
                'status'      => 'already_used',
                'message'     => 'Kode ini sudah digunakan untuk sesi foto.',
                'result_url'  => '/result/event/' . $redeemCode->code,
                'redeem_code' => $redeemCode->only(['code', 'buyer_name']),
                'event'       => $redeemCode->event->only(['name', 'slug', 'organizer_name']),
                'package'     => $redeemCode->package->only(['name', 'photo_count']),
            ]);
        }

        // Valid and unused
        return response()->json([
            'status'      => 'valid',
            'message'     => 'Kode valid! Sesi foto siap dimulai.',
            'redeem_code' => $redeemCode->only(['id', 'code', 'buyer_name', 'buyer_email', 'buyer_phone']),
            'event'       => array_merge(
                $redeemCode->event->only(['id', 'name', 'slug', 'organizer_name']),
                [
                    'frame'          => $redeemCode->event->frameTemplate,
                    'frame_templates'=> $redeemCode->event->frameTemplates->values(),
                ]
            ),
            'package'     => array_merge(
                $redeemCode->package->only(['id', 'name', 'photo_count', 'description', 'print_count']),
                ['frame' => $redeemCode->package->frameTemplate]
            ),
        ]);
    }

    /**
     * PUBLIC: Start a photoshoot session using a redeem code.
     * Marks code as used and creates a new PhotoSession tied to the event.
     */
    public function startSession(Request $request)
    {
        $request->validate([
            'code'        => 'required|string',
            'buyer_name'  => 'nullable|string|max:255',
            'buyer_email' => 'nullable|email|max:255',
            'buyer_phone' => 'nullable|string|max:20',
        ]);

        $redeemCode = EventRedeemCode::with(['event', 'package'])
            ->where('code', strtoupper(trim($request->code)))
            ->lockForUpdate()
            ->firstOrFail();

        if ($redeemCode->payment_status !== 'paid') {
            return response()->json(['message' => 'Kode belum dibayar.'], 402);
        }

        if ($redeemCode->is_used) {
            return response()->json(['message' => 'Kode sudah digunakan.'], 409);
        }

        if ($redeemCode->event->isExpired() || !$redeemCode->event->is_active) {
            return response()->json(['message' => 'Event sudah berakhir.'], 410);
        }

        // Determine frame: package frame takes priority, then event frame
        $frameId = $redeemCode->package->frame_template_id
            ?? $redeemCode->event->frame_template_id;

        // Create PhotoSession
        $session = PhotoSession::create([
            'user_id'               => $request->user()?->id,
            'frame_id'              => $frameId,
            'status'                => 'active',
            'event_id'              => $redeemCode->event_id,
            'event_redeem_code_id'  => $redeemCode->id,
            'max_photos'            => $redeemCode->package->photo_count,
            'session_duration'      => $redeemCode->package->session_duration ?? 180,
            'payment_status'        => 'paid', // Already paid via event purchase
        ]);

        // Update buyer details if provided, fallback to current or default
        $buyerName  = $request->buyer_name ?: $redeemCode->buyer_name;
        $buyerEmail = $request->filled('buyer_email') ? $request->buyer_email : $redeemCode->buyer_email;
        $buyerPhone = $request->filled('buyer_phone') ? $request->buyer_phone : $redeemCode->buyer_phone;

        // Mark redeem code as used
        $redeemCode->update([
            'is_used'          => true,
            'used_at'          => now(),
            'photo_session_id' => $session->id,
            'buyer_name'       => $buyerName ?: 'Peserta',
            'buyer_email'      => $buyerEmail,
            'buyer_phone'      => $buyerPhone,
        ]);

        return response()->json([
            'session' => $session->load(['frame', 'photos']),
            'package' => $redeemCode->package->only(['name', 'photo_count', 'print_count']),
            'event'   => array_merge(
                $redeemCode->event->only(['name', 'slug', 'organizer_name']),
                [
                    'frame_templates' => $redeemCode->event->frameTemplates()->get(['frame_templates.id'])->values(),
                ]
            ),
        ], 201);
    }

    /**
     * PUBLIC: Get photo result for a redeem code.
     * Used for viewing results via code, link in email/WA, or QR scan.
     */
    public function getResult(string $code)
    {
        $redeemCode = EventRedeemCode::with([
            'event',
            'package',
            'photoSession' => function ($q) {
                $q->with(['frame', 'photos']);
            }
        ])->where('code', strtoupper(trim($code)))->firstOrFail();

        if (!$redeemCode->is_used || !$redeemCode->photoSession) {
            return response()->json([
                'message' => 'Sesi foto untuk kode ini belum ditemukan.',
                'status'  => 'no_session',
            ], 404);
        }

        $session = $redeemCode->photoSession;
        $responseData = [
            'redeem_code' => $redeemCode->only(['code', 'buyer_name']),
            'event'       => $redeemCode->event->only(['name', 'organizer_name', 'event_date', 'location']),
            'package'     => $redeemCode->package->only(['name', 'photo_count']),
            'session'     => $session->toArray(),
        ];

        if ($session->final_image_path) {
            $responseData['final_image_url'] = Storage::disk('public')->url($session->final_image_path);
        }

        foreach ($responseData['session']['photos'] ?? [] as &$photo) {
            $photo['url'] = Storage::disk('public')->url($photo['file_path']);
        }

        return response()->json($responseData);
    }

    /**
     * Send result link to buyer via email/WhatsApp after session is completed.
     */
    public function sendResultNotification(EventRedeemCode $redeemCode): void
    {
        $resultUrl  = url('/result/event/' . $redeemCode->code);
        $eventName  = $redeemCode->event->name ?? 'Event';
        $buyerName  = $redeemCode->buyer_name;

        // Send email if buyer_email is set
        if ($redeemCode->buyer_email) {
            try {
                Mail::raw(
                    "Halo {$buyerName}!\n\n"
                    . "Foto kamu dari {$eventName} sudah siap! 🎉\n\n"
                    . "Klik link berikut untuk melihat & mendownload hasil foto kamu:\n"
                    . "👉 {$resultUrl}\n\n"
                    . "Atau buka fotoseeni.com/redeem dan masukkan kode: {$redeemCode->code}\n\n"
                    . "Kode ini hanya untukmu, harap dijaga baik-baik.\n\n"
                    . "Salam,\nTim fotoseeni",
                    function ($message) use ($redeemCode, $eventName) {
                        $message->to($redeemCode->buyer_email, $redeemCode->buyer_name)
                                ->subject("📸 Hasil Foto {$eventName} Sudah Siap!");
                    }
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send event result email: ' . $e->getMessage());
            }
        }

        // Mark notification as sent
        $redeemCode->update(['result_notified_at' => now()]);
    }

    /**
     * ADMIN: List all redeem codes for an event.
     */
    public function adminList(Request $request, Event $event)
    {
        $query = $event->redeemCodes()->with('package');

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        if ($request->filled('is_used')) {
            $query->where('is_used', filter_var($request->is_used, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('buyer_name', 'like', "%{$search}%")
                  ->orWhere('buyer_email', 'like', "%{$search}%")
                  ->orWhere('buyer_phone', 'like', "%{$search}%");
            });
        }

        return response()->json($query->latest()->paginate(20));
    }

    /**
     * ADMIN: Manually generate redeem codes for an event.
     */
    public function adminStore(Request $request, Event $event)
    {
        $request->validate([
            'event_package_id' => 'required|exists:event_packages,id',
            'buyer_name'       => 'nullable|string|max:255',
            'buyer_email'      => 'nullable|email|max:255',
            'buyer_phone'      => 'nullable|string|max:20',
            'quantity'         => 'required|integer|min:1|max:100',
            'payment_status'   => 'required|in:paid,unpaid,pending',
        ]);

        $package = $event->packages()->where('id', $request->event_package_id)->firstOrFail();

        $codes = [];
        for ($i = 0; $i < $request->quantity; $i++) {
            $codeStr = EventRedeemCode::generateCode($event);
            $baseName = $request->buyer_name ?: 'Peserta';
            $redeemCode = EventRedeemCode::create([
                'event_id'         => $event->id,
                'event_package_id' => $package->id,
                'code'             => $codeStr,
                'buyer_name'       => $baseName . ($request->quantity > 1 ? ' #' . ($i + 1) : ''),
                'buyer_email'      => $request->buyer_email,
                'buyer_phone'      => $request->buyer_phone,
                'payment_status'   => $request->payment_status,
                'payment_amount'   => $package->price,
                'payment_paid_at'  => $request->payment_status === 'paid' ? now() : null,
            ]);
            $codes[] = $redeemCode;
        }

        return response()->json([
            'message' => 'Berhasil membuat ' . count($codes) . ' kode redeem.',
            'codes'   => $codes,
        ], 201);
    }

    /**
     * ADMIN: Delete a redeem code.
     */
    public function adminDestroy(Event $event, EventRedeemCode $redeemCode)
    {
        abort_if($redeemCode->event_id !== $event->id, 404);
        $redeemCode->delete();
        return response()->json(['message' => 'Kode redeem berhasil dihapus.']);
    }

    /**
     * ADMIN: Mark an unpaid/pending redeem code as paid.
     */
    public function adminMarkPaid(Event $event, EventRedeemCode $redeemCode)
    {
        abort_if($redeemCode->event_id !== $event->id, 404);
        $redeemCode->update([
            'payment_status'  => 'paid',
            'payment_paid_at' => now(),
        ]);
        return response()->json([
            'message' => 'Kode redeem berhasil ditandai sebagai Lunas.',
            'redeem_code' => $redeemCode
        ]);
    }
}
