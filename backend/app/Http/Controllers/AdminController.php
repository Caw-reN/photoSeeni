<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\PhotoSession;
use App\Models\Setting;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    /**
     * Get overview statistics for the admin dashboard.
     */
    public function stats()
    {
        $totalUsers = User::count();
        $totalSessions = PhotoSession::count();
        $completedSessions = PhotoSession::where('status', 'completed')->count();
        $todaySessions = PhotoSession::whereDate('created_at', today())->count();
        $totalRevenue = PhotoSession::where('payment_status', 'paid')->sum('payment_amount');
        $pendingPayments = PhotoSession::where('payment_status', 'pending')->count();
        $paidPayments = PhotoSession::where('payment_status', 'paid')->count();

        // Recent 7-day session counts for a simple chart
        $dailySessions = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dailySessions[] = [
                'date' => $date,
                'count' => PhotoSession::whereDate('created_at', $date)->count(),
                'revenue' => (float) PhotoSession::whereDate('created_at', $date)
                    ->where('payment_status', 'paid')
                    ->sum('payment_amount'),
            ];
        }

        return response()->json([
            'total_users' => $totalUsers,
            'total_sessions' => $totalSessions,
            'completed_sessions' => $completedSessions,
            'today_sessions' => $todaySessions,
            'total_revenue' => (float) $totalRevenue,
            'pending_payments' => $pendingPayments,
            'paid_payments' => $paidPayments,
            'daily_sessions' => $dailySessions,
        ]);
    }

    /**
     * List all users with pagination.
     */
    public function users(Request $request)
    {
        $query = User::withCount('photoSessions');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->latest()->paginate(15);

        return response()->json($users);
    }

    /**
     * Update a user's role.
     */
    public function updateUserRole(Request $request, User $user)
    {
        $request->validate([
            'role' => 'required|in:user,admin',
        ]);

        $user->update(['role' => $request->role]);

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => $user->loadCount('photoSessions'),
        ]);
    }

    /**
     * List all transactions (photo sessions with payment info).
     */
    public function transactions(Request $request)
    {
        $query = PhotoSession::with(['user', 'frame']);

        // Filter by payment status
        if ($request->has('payment_status') && $request->payment_status) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by session status
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        // Search by reference ID or user name
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('payment_reference_id', 'like', "%{$search}%")
                  ->orWhere('payment_trx_id', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                          ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        $transactions = $query->latest()->paginate(15);

        return response()->json($transactions);
    }

    /**
     * Get payment enabled/disabled setting and pricing.
     */
    public function getPaymentSettings()
    {
        return response()->json([
            'payment_enabled' => Setting::getValue('payment_enabled', 'true') === 'true',
            'session_price' => (int) Setting::getValue('session_price', '25000'),
            'service_fee' => (int) Setting::getValue('service_fee', '1500'),
        ]);
    }

    /**
     * Toggle payment enabled/disabled and update pricing.
     */
    public function setPaymentSettings(Request $request)
    {
        $request->validate([
            'payment_enabled' => 'sometimes|boolean',
            'session_price' => 'sometimes|numeric|min:0',
            'service_fee' => 'sometimes|numeric|min:0',
        ]);

        if ($request->has('payment_enabled')) {
            Setting::setValue('payment_enabled', $request->payment_enabled ? 'true' : 'false');
        }
        if ($request->has('session_price')) {
            Setting::setValue('session_price', (string)$request->session_price);
        }
        if ($request->has('service_fee')) {
            Setting::setValue('service_fee', (string)$request->service_fee);
        }

        return response()->json([
            'message' => 'Payment settings updated successfully.',
            'payment_enabled' => Setting::getValue('payment_enabled', 'true') === 'true',
            'session_price' => (int) Setting::getValue('session_price', '25000'),
            'service_fee' => (int) Setting::getValue('service_fee', '1500'),
        ]);
    }
}
