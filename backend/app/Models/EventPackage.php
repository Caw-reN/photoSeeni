<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EventPackage extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'name',
        'description',
        'price',
        'photo_count',
        'frame_template_id',
        'is_active',
        'sort_order',
        'session_duration',
    ];

    protected $casts = [
        'price' => 'integer',
        'photo_count' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'session_duration' => 'integer',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function frameTemplate(): BelongsTo
    {
        return $this->belongsTo(FrameTemplate::class, 'frame_template_id');
    }

    public function redeemCodes(): HasMany
    {
        return $this->hasMany(EventRedeemCode::class);
    }
}
