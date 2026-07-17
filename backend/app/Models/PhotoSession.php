<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class PhotoSession extends Model
{
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (PhotoSession $session) {
            if (empty($session->uuid)) {
                $session->uuid = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'uuid',
        'user_id',
        'frame_id',
        'status',
        'final_image_path',
        'payment_status',
        'payment_trx_id',
        'payment_reference_id',
        'payment_qr_url',
        'payment_qr_string',
        'payment_amount',
        'payment_paid_at',
        'event_id',
        'event_redeem_code_id',
        'max_photos',
        'gif_speed',
        'session_duration',
        'final_image_paths',
        'custom_texts',
    ];

    protected $casts = [
        'payment_paid_at' => 'datetime',
        'max_photos' => 'integer',
        'gif_speed' => 'integer',
        'session_duration' => 'integer',
        'final_image_paths' => 'array',
        'custom_texts' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function frame(): BelongsTo
    {
        return $this->belongsTo(FrameTemplate::class, 'frame_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function redeemCode(): BelongsTo
    {
        return $this->belongsTo(EventRedeemCode::class, 'event_redeem_code_id');
    }

    public function isEventSession(): bool
    {
        return !is_null($this->event_id);
    }
}