<?php

namespace App\Http\Controllers;

use App\Http\Requests\PixelforgeWebhook\StorePixelforgeWebhookRequest;
use App\Services\GenerationService;
use Illuminate\Http\Response;

class PixelforgeWebhookController extends Controller
{
    public function __construct(private readonly GenerationService $generationService) {}

    public function store(StorePixelforgeWebhookRequest $request): Response
    {
        $event = $request->validated();
        $this->generationService->handleGenerationWebhook(event: $event);

        return response()->noContent();
    }
}
