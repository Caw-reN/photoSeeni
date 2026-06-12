<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FrameController;
use App\Http\Controllers\PhotoSessionController;
use App\Http\Controllers\FrameTemplateController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\AdminController;

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

// Public webhook from Paymenku
Route::post('/webhook/paymentku', [PhotoSessionController::class, 'handleWebhook']);

// Photo session payments (Publicly accessible, controller handles ownership check)
Route::post('/sessions/{session}/pay', [PhotoSessionController::class, 'initiatePayment']);
Route::get('/sessions/{session}/payment-status', [PhotoSessionController::class, 'checkPaymentStatus']);

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
});
