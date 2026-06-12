<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PhotoSession extends Model
{
    use HasFactory;

    protected $fillable = [
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
    ];

    protected $casts = [
        'payment_paid_at' => 'datetime',
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
}