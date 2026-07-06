<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FrameController;
use App\Http\Controllers\PhotoSessionController;
use App\Http\Controllers\FrameTemplateController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\EventPackageController;
use App\Http\Controllers\EventRedeemController;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/frames', [FrameController::class, 'index']);
Route::post('/sessions', [PhotoSessionController::class, 'store']); // Create anonymous or authenticated session
Route::post('/sessions/{session}/photos', [PhotoSessionController::class, 'uploadPhoto']);
Route::post('/sessions/{session}/complete', [PhotoSessionController::class, 'complete']);
Route::get('/sessions/{session}', [PhotoSessionController::class, 'show']);

Route::get('/settings/public', [SettingController::class, 'getPublicSettings']);

Route::get('/frame-templates', [FrameTemplateController::class, 'index']);
Route::get('/frame-templates/{frameTemplate}', [FrameTemplateController::class, 'show']);
Route::get('/frame-templates/{frameTemplate}/image', [FrameTemplateController::class, 'streamImage']);

// Direct file download routes
Route::get('/sessions/{session}/download-strip', [PhotoSessionController::class, 'downloadStrip']);
Route::get('/photos/{photo}/download', [PhotoSessionController::class, 'downloadPhoto']);

// Public webhook from Paymenku (regular sessions)
Route::post('/webhook/paymentku', [PhotoSessionController::class, 'handleWebhook']);

// Public webhook from Paymenku (event package purchases)
Route::post('/webhook/event-payment', [EventRedeemController::class, 'paymentWebhook']);

// Photo session payments (Publicly accessible, controller handles ownership check)
Route::post('/sessions/{session}/pay', [PhotoSessionController::class, 'initiatePayment']);
Route::get('/sessions/{session}/payment-status', [PhotoSessionController::class, 'checkPaymentStatus']);

// ─────────────────────────────────────────────
// Event Public Routes
// ─────────────────────────────────────────────

// View event info + packages (for purchase page)
Route::get('/events/{slug}', [EventController::class, 'show']);
Route::get('/events/{slug}/packages', [EventPackageController::class, 'index']);

// Purchase a package → get redeem code + QRIS payment
Route::post('/events/{slug}/purchase', [EventRedeemController::class, 'purchase']);

// Poll purchase payment status
Route::post('/events/redeem/payment-status', [EventRedeemController::class, 'checkPurchaseStatus']);

// Validate redeem code before starting session
Route::post('/events/redeem/validate', [EventRedeemController::class, 'validate']);

// Start photoshoot session using a valid redeem code
Route::post('/events/redeem/start-session', [EventRedeemController::class, 'startSession']);

// Get photo result by redeem code (for email/WA link, QR scan, or manual entry)
Route::get('/events/redeem/{code}/result', [EventRedeemController::class, 'getResult']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/frames', [FrameController::class, 'store']);
    Route::delete('/frames/{frame}', [FrameController::class, 'destroy']);

    Route::get('/my-sessions', [PhotoSessionController::class, 'index']);
    Route::delete('/sessions/{session}', [PhotoSessionController::class, 'destroy']);

    // Frame templates administration (authenticated, admin check inside controller or use admin middleware)
    Route::post('/frame-templates', [FrameTemplateController::class, 'store']);
    Route::post('/frame-templates/{frameTemplate}', [FrameTemplateController::class, 'update']);
    Route::delete('/frame-templates/{frameTemplate}', [FrameTemplateController::class, 'destroy']);
});

// Admin routes (requires auth + admin role)
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::patch('/frame-templates/{frameTemplate}/toggle-active', [FrameTemplateController::class, 'toggleActive']);

    // Dashboard stats
    Route::get('/stats', [AdminController::class, 'stats']);

    // User management
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{user}', [AdminController::class, 'updateUserRole']);

    // Transaction management
    Route::get('/transactions', [AdminController::class, 'transactions']);

    // Paymentku API key settings
    Route::get('/settings/paymentku', [SettingController::class, 'getPaymentku']);
    Route::post('/settings/paymentku', [SettingController::class, 'setPaymentku']);

    // Payment toggle settings
    Route::get('/settings/payment', [AdminController::class, 'getPaymentSettings']);
    Route::post('/settings/payment', [AdminController::class, 'setPaymentSettings']);

    // ─────────────────────────────────────────────
    // Event Admin Routes
    // ─────────────────────────────────────────────
    Route::get('/events', [EventController::class, 'index']);
    Route::post('/events', [EventController::class, 'store']);
    Route::put('/events/{event}', [EventController::class, 'update']);
    Route::patch('/events/{event}', [EventController::class, 'update']);
    Route::delete('/events/{event}', [EventController::class, 'destroy']);
    Route::get('/events/{event}/stats', [EventController::class, 'stats']);

    // Event packages (admin CRUD)
    Route::post('/events/{event}/packages', [EventPackageController::class, 'store']);
    Route::put('/events/{event}/packages/{package}', [EventPackageController::class, 'update']);
    Route::patch('/events/{event}/packages/{package}', [EventPackageController::class, 'update']);
    Route::delete('/events/{event}/packages/{package}', [EventPackageController::class, 'destroy']);

    // Event redeem codes list (admin)
    Route::get('/events/{event}/redeem-codes', [EventRedeemController::class, 'adminList']);
});

