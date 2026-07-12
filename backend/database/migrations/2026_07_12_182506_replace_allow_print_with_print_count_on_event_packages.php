<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replace the boolean allow_print column with an integer print_count.
     * Conversion: allow_print = true → print_count = 1
     *             allow_print = false → print_count = 0
     */
    public function up(): void
    {
        Schema::table('event_packages', function (Blueprint $table) {
            $table->integer('print_count')->default(1)->after('allow_print');
        });

        // Migrate existing data
        DB::statement('UPDATE event_packages SET print_count = CASE WHEN allow_print = 1 THEN 1 ELSE 0 END');

        Schema::table('event_packages', function (Blueprint $table) {
            $table->dropColumn('allow_print');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('event_packages', function (Blueprint $table) {
            $table->boolean('allow_print')->default(true)->after('session_duration');
        });

        DB::statement('UPDATE event_packages SET allow_print = CASE WHEN print_count > 0 THEN 1 ELSE 0 END');

        Schema::table('event_packages', function (Blueprint $table) {
            $table->dropColumn('print_count');
        });
    }
};
