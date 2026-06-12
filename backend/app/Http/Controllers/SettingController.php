<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * Get Paymentku configuration settings.
     */
    public function getPaymentku()
    {
        return response()->json([
            'paymentku_api_key' => Setting::getValue('paymentku_api_key', ''),
            'webhook_token' => Setting::getValue('webhook_token', ''),
        ]);
    }

    /**
     * Update Paymentku configuration settings.
     */
    public function setPaymentku(Request $request)
    {
        $request->validate([
            'paymentku_api_key' => 'nullable|string|max:255',
            'webhook_token' => 'nullable|string|max:255',
        ]);

        Setting::setValue('paymentku_api_key', $request->paymentku_api_key ?? '');
        Setting::setValue('webhook_token', $request->webhook_token ?? '');

        return response()->json([
            'message' => 'Paymentku settings updated successfully.',
            'paymentku_api_key' => Setting::getValue('paymentku_api_key', ''),
            'webhook_token' => Setting::getValue('webhook_token', ''),
        ]);
    }

    /**
     * Get public settings (pricing, feature flags)
     */
    public function getPublicSettings()
    {
        return response()->json([
            'payment_enabled' => Setting::getValue('payment_enabled', 'true') === 'true',
            'session_price' => (int) Setting::getValue('session_price', '25000'),
            'service_fee' => (int) Setting::getValue('service_fee', '1500'),
        ]);
    }
}
