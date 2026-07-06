<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class EventRedeemCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'event_package_id',
        'code',
        'qr_image_path',
        'buyer_name',
        'buyer_email',
        'buyer_phone',
        'payment_status',
        'payment_trx_id',
        'payment_reference_id',
        'payment_qr_url',
        'payment_qr_string',
        'payment_amount',
        'payment_paid_at',
        'is_used',
        'used_at',
        'photo_session_id',
        'result_notified_at',
    ];

    protected $casts = [
        'payment_paid_at' => 'datetime',
        'used_at' => 'datetime',
        'result_notified_at' => 'datetime',
        'is_used' => 'boolean',
        'payment_amount' => 'decimal:2',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(EventPackage::class, 'event_package_id');
    }

    public function photoSession(): BelongsTo
    {
        return $this->belongsTo(PhotoSession::class);
    }

    /**
     * Generate a unique redeem code for an event.
     * Format: [EVENT_PREFIX]-[RANDOM8]
     */
    public static function generateCode(Event $event): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Z0-9]/i', '', $event->slug), 0, 6));
        do {
            $code = $prefix . '-' . strtoupper(Str::random(8));
        } while (self::where('code', $code)->exists());

        return $code;
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }

    public function isAvailableForSession(): bool
    {
        return $this->isPaid() && !$this->is_used;
    }
}
