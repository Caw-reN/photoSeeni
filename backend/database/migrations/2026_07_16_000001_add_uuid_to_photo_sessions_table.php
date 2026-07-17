<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add uuid column (nullable first so existing rows don't fail)
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->uuid('uuid')->nullable()->after('id');
        });

        // 2. Generate UUID for all existing rows
        DB::table('photo_sessions')->whereNull('uuid')->orderBy('id')->each(function ($row) {
            DB::table('photo_sessions')
                ->where('id', $row->id)
                ->update(['uuid' => (string) Str::uuid()]);
        });

        // 3. Make uuid not-nullable and add unique index
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->uuid('uuid')->nullable(false)->unique()->change();
        });
    }

    public function down(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropUnique(['uuid']);
            $table->dropColumn('uuid');
        });
    }
};
