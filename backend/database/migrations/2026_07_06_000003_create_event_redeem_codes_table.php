<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_redeem_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
            $table->foreignId('event_package_id')->constrained('event_packages')->onDelete('cascade');
            $table->string('code')->unique(); // e.g. SMA1-2025-ABCD1234
            $table->string('qr_image_path')->nullable(); // Generated QR image stored on disk

            // Buyer info (collected at purchase time)
            $table->string('buyer_name');
            $table->string('buyer_email')->nullable();
            $table->string('buyer_phone')->nullable(); // WhatsApp number

            // Payment fields (mirrors photo_sessions payment pattern)
            $table->string('payment_status')->default('unpaid'); // unpaid, pending, paid
            $table->string('payment_trx_id')->nullable();
            $table->string('payment_reference_id')->nullable();
            $table->text('payment_qr_url')->nullable();
            $table->text('payment_qr_string')->nullable();
            $table->decimal('payment_amount', 12, 2)->default(0.00);
            $table->timestamp('payment_paid_at')->nullable();

            // Usage tracking
            $table->boolean('is_used')->default(false); // Used for photoshoot session
            $table->timestamp('used_at')->nullable();
            $table->foreignId('photo_session_id')->nullable()->constrained('photo_sessions')->onDelete('set null');

            // Notification tracking
            $table->timestamp('result_notified_at')->nullable(); // When link was sent to buyer

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_redeem_codes');
    }
};
