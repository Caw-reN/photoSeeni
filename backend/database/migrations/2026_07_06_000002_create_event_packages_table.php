<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
            $table->string('name'); // e.g. "Paket Silver", "Paket Gold"
            $table->text('description')->nullable();
            $table->integer('price'); // Dynamic — can be changed by admin anytime
            $table->integer('photo_count'); // Number of photo slots (e.g. 2, 4, 6)
            $table->foreignId('frame_template_id')->nullable()->constrained('frame_templates')->onDelete('set null');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_packages');
    }
};
