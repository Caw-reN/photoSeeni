<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropForeign(['frame_id']);
            $table->foreign('frame_id')
                  ->references('id')
                  ->on('frame_templates')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropForeign(['frame_id']);
            $table->foreign('frame_id')
                  ->references('id')
                  ->on('frames')
                  ->onDelete('set null');
        });
    }
};
