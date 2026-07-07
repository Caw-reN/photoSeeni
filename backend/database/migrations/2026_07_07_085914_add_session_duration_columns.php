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
        Schema::table('event_packages', function (Blueprint $table) {
            $table->integer('session_duration')->default(180)->after('photo_count'); // duration in seconds
        });

        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->integer('session_duration')->default(180)->after('max_photos'); // duration in seconds
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('event_packages', function (Blueprint $table) {
            $table->dropColumn('session_duration');
        });

        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropColumn('session_duration');
        });
    }
};
