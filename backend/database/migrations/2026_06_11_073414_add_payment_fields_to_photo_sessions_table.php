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
            $table->string('payment_status')->default('unpaid')->after('status');
            $table->string('payment_trx_id')->nullable()->after('payment_status');
            $table->string('payment_reference_id')->nullable()->after('payment_trx_id');
            $table->text('payment_qr_url')->nullable()->after('payment_reference_id');
            $table->text('payment_qr_string')->nullable()->after('payment_qr_url');
            $table->decimal('payment_amount', 12, 2)->default(0.00)->after('payment_qr_string');
            $table->timestamp('payment_paid_at')->nullable()->after('payment_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'payment_status',
                'payment_trx_id',
                'payment_reference_id',
                'payment_qr_url',
                'payment_qr_string',
                'payment_amount',
                'payment_paid_at',
            ]);
        });
    }
};
