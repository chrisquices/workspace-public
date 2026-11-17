<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\GenerationController;
use App\Http\Controllers\PixelforgeWebhookController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UsageController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;

// Public routes
Route::middleware([])->group(function () {

    // Webhooks
    Route::prefix('webhooks')->name('webhooks.')->group(function () {
        Route::post('/pixelforge', [PixelforgeWebhookController::class, 'store'])->name('pixelforge');
    });

    // Generation landing route
    Route::prefix('')->name('')->group(function () {
        Route::any('/', [GenerationController::class, 'redirectToIndex'])->name('home.index');
    });
});

// Guest routes
Route::middleware('guest')->group(function () {

    // Registration routes
    Route::prefix('register')->name('register.')->group(function () {
        Route::get('/', [RegisterController::class, 'index'])->name('index');
        Route::post('/', [RegisterController::class, 'submit'])->middleware('throttle:5,1')->name('submit');
    });

    // Login routes
    Route::prefix('login')->name('login.')->group(function () {
        Route::get('/', [LoginController::class, 'index'])->name('index');
        Route::post('/', [LoginController::class, 'submit'])->middleware('throttle:login')->name('submit');
    });

});

// Authenticated routes
Route::middleware('auth')->group(function () {

    // Logout routes
    Route::prefix('logout')->name('logout.')->group(function () {
        Route::post('/', [AuthenticatedSessionController::class, 'destroy'])->name('submit');
    });
});

// Application routes
Route::middleware(['auth', 'verified'])->group(function () {

    // Usage routes
    Route::prefix('usage')->name('usage.')->group(function () {
        Route::get('/', [UsageController::class, 'index'])->name('index');
    });

    // Transaction routes
    Route::prefix('transactions')->name('transactions.')->group(function () {
        Route::post('/', [TransactionController::class, 'store'])->middleware('throttle:20,1')->name('store');
    });

    // Generation routes
    Route::prefix('generations')->name('generations.')->group(function () {
        Route::get('/', [GenerationController::class, 'index'])->name('index');
        Route::post('/', [GenerationController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::post('/estimate', [GenerationController::class, 'estimate'])->middleware('throttle:120,1')->name('estimate');
        Route::delete('/{uuid}', [GenerationController::class, 'delete'])->whereUuid('uuid')->name('delete');
    });
});
