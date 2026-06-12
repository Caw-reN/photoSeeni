<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Photo extends Model
{
    use HasFactory;

    protected $fillable = [
        'photo_session_id',
        'slot_index',
        'file_path',
    ];

    public function photoSession(): BelongsTo
    {
        return $this->belongsTo(PhotoSession::class);
    }
}