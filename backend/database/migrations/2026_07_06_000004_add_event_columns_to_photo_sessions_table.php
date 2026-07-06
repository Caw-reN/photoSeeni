<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->foreignId('event_id')->nullable()->constrained('events')->onDelete('set null')->after('frame_id');
            $table->foreignId('event_redeem_code_id')->nullable()->constrained('event_redeem_codes')->onDelete('set null')->after('event_id');
            $table->integer('max_photos')->nullable()->after('event_redeem_code_id'); // Override max slots from package
        });
    }

    public function down(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropForeign(['event_id']);
            $table->dropForeign(['event_redeem_code_id']);
            $table->dropColumn(['event_id', 'event_redeem_code_id', 'max_photos']);
        });
    }
};
