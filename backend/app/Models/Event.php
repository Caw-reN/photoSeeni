<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'organizer_name',
        'location',
        'event_date',
        'frame_template_id',
        'is_active',
        'expires_at',
        'created_by',
    ];

    protected $casts = [
        'event_date' => 'date',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function frameTemplate(): BelongsTo
    {
        return $this->belongsTo(FrameTemplate::class, 'frame_template_id');
    }

    // Multiple frame templates linked to this event (via pivot)
    public function frameTemplates(): BelongsToMany
    {
        return $this->belongsToMany(FrameTemplate::class, 'event_frame_templates')->withTimestamps();
    }

    public function packages(): HasMany
    {
        return $this->hasMany(EventPackage::class)->orderBy('sort_order');
    }

    public function redeemCodes(): HasMany
    {
        return $this->hasMany(EventRedeemCode::class);
    }

    public function photoSessions(): HasMany
    {
        return $this->hasMany(PhotoSession::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
