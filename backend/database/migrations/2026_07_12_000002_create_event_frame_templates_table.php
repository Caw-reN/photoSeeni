<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_frame_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('frame_template_id')->constrained('frame_templates')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['event_id', 'frame_template_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_frame_templates');
    }
};
