<?php

namespace App\Http\Controllers;

use App\Exceptions\PixelforgeApiException;
use App\Http\Requests\Generation\EstimateGenerationRequest;
use App\Http\Requests\Generation\IndexGenerationRequest;
use App\Http\Requests\Generation\StoreGenerationRequest;
use App\Http\Resources\Generation\GenerationEstimateResource;
use App\Http\Resources\Generation\GenerationResource;
use App\Services\GenerationService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class GenerationController extends Controller
{
    public function __construct(private readonly GenerationService $generationService) {}

    public function redirectToIndex(): RedirectResponse
    {
        return to_route('generations.index');
    }

    public function index(IndexGenerationRequest $request): Response
    {
        $user = $request->user();

        $filters = [
            'search' => $request->validated(key: 'search') ?? '',
            'sortBy' => $request->validated(key: 'sortBy', default: 'created_at'),
            'sortDirection' => $request->validated(key: 'sortDirection', default: 'desc'),
        ];

        $generationsRaw = $this->generationService->getGenerations(userId: $user->id, search: $filters['search'], sortBy: $filters['sortBy'], sortDirection: $filters['sortDirection']);
        $generations = GenerationResource::collection(resource: $generationsRaw)->resolve(request: $request);

        return Inertia::render(component: 'Generations/Index', props: [
            'filters' => $filters,
            'generations' => $generations,
        ]);
    }

    public function store(StoreGenerationRequest $request): JsonResponse|RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        try {
            $this->generationService->storeGeneration(userId: $user->id, submissionKey: $data['submissionKey'], prompt: $data['prompt'], size: $data['size'], quality: $data['quality'], referenceImages: $data['referenceImages'] ?? []);
        } catch (PixelforgeApiException $exception) {
            report($exception);

            $errors = [
                'submissionKey' => 'We couldn’t check the price of your image. Please try again.',
            ];

            if ($request->expectsJson()) {
                return response()->json(data: [
                    'errors' => $errors,
                ], status: 422);
            }

            return back()->withErrors(provider: $errors);
        }

        if ($request->expectsJson()) {
            return response()->json(data: [
                'accepted' => true,
            ], status: 202);
        }

        return to_route('generations.index');
    }

    public function delete(Request $request, string $uuid): RedirectResponse
    {
        $user = $request->user();

        try {
            $this->generationService->deleteGeneration(userId: $user->id, uuid: $uuid);
        } catch (ModelNotFoundException) {
            abort(404);
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors(provider: [
                'generation' => 'We couldn’t delete this generation. Please try again.',
            ]);
        }

        return back();
    }

    public function estimate(EstimateGenerationRequest $request): JsonResponse
    {
        $data = $request->validated();

        try {
            $estimateRaw = $this->generationService->estimateGeneration(prompt: $data['prompt'], size: $data['size'], quality: $data['quality'], referenceImageCount: (int) $data['referenceImageCount']);
        } catch (PixelforgeApiException $exception) {
            report($exception);

            return response()->json(data: [
                'message' => 'Pricing is temporarily unavailable. Please try again.',
            ], status: 503);
        }

        $estimate = GenerationEstimateResource::make(resource: $estimateRaw)->resolve(request: $request);

        return response()->json(data: [
            'estimate' => $estimate,
        ]);
    }
}
