<?php

namespace App\Services;

use App\Exceptions\PixelforgeApiException;
use App\Helpers\GenerationHelper;
use App\Jobs\SubmitGenerationJob;
use App\Models\Generation;
use App\Models\User;
use App\Models\WebhookEvent;
use Brick\Math\BigDecimal;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use LogicException;
use Throwable;

class GenerationService
{
    private const REJECTION_CODES = ['invalid_api_key', 'validation_failed', 'content_policy_violation', 'not_found', 'rate_limit_exceeded', 'concurrency_limit_exceeded', 'daily_limit_exceeded', 'overloaded', 'configuration_error'];

    public function __construct(private readonly PixelforgeApiService $pixelforge, private readonly TransactionService $transactions) {}

    /** @return Collection<int, Generation> */
    public function getGenerations(int $userId, ?string $search = null, string $sortBy = 'created_at', string $sortDirection = 'desc'): Collection
    {
        $generations = Generation::query()
            ->where('user_id', $userId);

        if ($search !== null && $search !== '') {
            $generations->whereLike('prompt', '%'.$search.'%');
        }

        $sortColumn = match ($sortBy) {
            'prompt' => 'prompt',
            default => 'created_at',
        };

        return $generations
            ->orderBy($sortColumn, $sortDirection === 'asc' ? 'asc' : 'desc')
            ->orderByDesc('id')
            ->get();
    }

    /** @return array{currency: string, minPriceUsd: string, maxPriceUsd: string} */
    public function estimateGeneration(string $prompt, string $size, string $quality, int $referenceImageCount): array
    {
        $pricingCacheKey = 'pixelforge.pricing.'.hash('sha256', config('pixelforge.api.base_url').'/'.config('pixelforge.api.version'));

        $pricingRaw = Cache::remember($pricingCacheKey, 300, function (): array {
            $pricingRaw = $this->pixelforge->getPricing();

            return $pricingRaw;
        });

        $estimate = GenerationHelper::estimate($pricingRaw, $prompt, $size, $quality, $referenceImageCount);

        $currency = $estimate['currency'];
        $minPriceUsd = (string) BigDecimal::of($estimate['minCostUsd'])->multipliedBy(config('pixel.pricing.price_multiplier'));
        $maxPriceUsd = (string) BigDecimal::of($estimate['maxCostUsd'])->multipliedBy(config('pixel.pricing.price_multiplier'));

        return [
            'currency' => $currency,
            'minPriceUsd' => $minPriceUsd,
            'maxPriceUsd' => $maxPriceUsd,
        ];
    }

    /** @param array<int, UploadedFile> $referenceImages */
    public function storeGeneration(int $userId, string $submissionKey, string $prompt, string $size, string $quality, array $referenceImages = []): void
    {
        $generation = Generation::query()
            ->where('uuid', $submissionKey)
            ->first();

        if ($generation !== null) {
            if ($generation->user_id !== $userId) {
                throw ValidationException::withMessages([
                    'submissionKey' => 'We couldn’t submit your request. Please refresh the page and try again.',
                ]);
            }

            $this->queueSubmission($generation->id);

            return;
        }

        $key = config('pixelforge.api.key');
        if (! is_string($key) || trim($key) === '') {
            throw ValidationException::withMessages([
                'submissionKey' => 'Image generation is temporarily unavailable. Please try again later.',
            ]);
        }

        $pricingRaw = $this->pixelforge->getPricing();
        $estimate = GenerationHelper::estimate($pricingRaw, $prompt, $size, $quality, count($referenceImages));
        $amount = (string) BigDecimal::of($estimate['maxCostUsd'])->multipliedBy(config('pixel.pricing.price_multiplier'));
        $paths = [];
        $urls = [];
        $directory = 'generation-references/'.$userId.'/'.Str::uuid();

        try {
            foreach ($referenceImages as $referenceImage) {
                $path = $referenceImage->store($directory, 'public');
                if ($path === false) {
                    throw new LogicException('Unable to store a reference image.');
                }
                $paths[] = $path;
                $urls[] = Storage::disk('public')->url($path);
            }
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($paths);
            report($exception);
            throw ValidationException::withMessages([
                'referenceImages' => 'We couldn’t upload your reference images. Please try again.',
            ]);
        }

        try {
            $generation = DB::transaction(function () use ($userId, $submissionKey, $prompt, $size, $quality, $urls, $pricingRaw, $amount): Generation {
                User::query()
                    ->whereKey($userId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $existingGeneration = Generation::query()
                    ->where('uuid', $submissionKey)
                    ->first();

                if ($existingGeneration !== null) {
                    if ($existingGeneration->user_id !== $userId) {
                        throw ValidationException::withMessages([
                            'submissionKey' => 'We couldn’t submit your request. Please refresh the page and try again.',
                        ]);
                    }

                    return $existingGeneration;
                }

                $this->transactions->ensureCanGenerate($userId, $amount);

                return Generation::query()
                    ->create([
                        'uuid' => $submissionKey,
                        'user_id' => $userId,
                        'status' => 'pending',
                        'prompt' => $prompt,
                        'size' => $size,
                        'quality' => $quality,
                        'reference_images' => $urls,
                        'pricing_snapshot' => [
                            'pricing' => $pricingRaw,
                            'price_multiplier' => config('pixel.pricing.price_multiplier'),
                        ],
                        'estimated_cost' => $amount,
                        'reserved_amount' => $amount,
                    ]);
            });

            if (! $generation->wasRecentlyCreated) {
                Storage::disk('public')->delete($paths);
            }
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($paths);
            if (! $exception instanceof UniqueConstraintViolationException) {
                throw $exception;
            }

            $generation = Generation::query()
                ->where('uuid', $submissionKey)
                ->where('user_id', $userId)
                ->first();
            if ($generation === null) {
                throw ValidationException::withMessages([
                    'submissionKey' => 'We couldn’t submit your request. Please copy your prompt, refresh the page, and try again.',
                ]);
            }
        }

        $this->queueSubmission($generation->id);

    }

    public function deleteGeneration(int $userId, string $uuid): void
    {
        DB::transaction(function () use ($userId, $uuid): void {
            $generation = Generation::query()
                ->where('user_id', $userId)
                ->where('uuid', $uuid)
                ->lockForUpdate()
                ->firstOrFail();

            if ($generation->status !== 'failed' || $generation->provider_generation_id !== null) {
                throw ValidationException::withMessages([
                    'generation' => 'Only local failures without a provider ID can be deleted.',
                ]);
            }

            WebhookEvent::query()
                ->where('generation_id', $generation->id)
                ->delete();

            $generation->delete();
        });
    }

    public function submitGeneration(int $generationId): void
    {
        $submission = DB::transaction(function () use ($generationId): ?array {
            $generation = Generation::query()
                ->lockForUpdate()
                ->find($generationId);
            if ($generation === null || $generation->status !== 'pending' || $generation->provider_generation_id !== null) {
                return null;
            }

            $wasUncertain = $generation->error_code === 'submission_uncertain';

            // Persist before network I/O so an interrupted request is not mistaken for a rejection.
            $generation->update([
                'error_code' => 'submission_uncertain',
                'error_message' => 'Waiting to confirm your image request.',
            ]);

            $uuid = $generation->uuid;
            $prompt = $generation->prompt;
            $size = $generation->size;
            $quality = $generation->quality;
            $referenceImages = $generation->reference_images;

            return [
                'uuid' => $uuid,
                'prompt' => $prompt,
                'size' => $size,
                'quality' => $quality,
                'referenceImages' => $referenceImages,
                'wasUncertain' => $wasUncertain,
            ];
        });

        if ($submission === null) {
            return;
        }

        try {
            $generationRaw = $this->pixelforge->createGeneration(idempotencyKey: $submission['uuid'], prompt: $submission['prompt'], size: $submission['size'], quality: $submission['quality'], referenceImages: $submission['referenceImages'], metadata: [
                'generation_uuid' => $submission['uuid'],
            ]);
        } catch (Throwable $exception) {
            $code = $exception instanceof PixelforgeApiException ? $exception->errorCode : 'configuration_error';
            $definitive = ! $submission['wasUncertain']
                && (($exception instanceof PixelforgeApiException && ! $exception->mayHaveBeenAccepted && in_array($code, self::REJECTION_CODES, true))
                    || $exception instanceof LogicException || $exception instanceof ValidationException);

            if ($definitive) {
                Generation::query()
                    ->whereKey($generationId)
                    ->where('status', 'pending')
                    ->whereNull('provider_generation_id')
                    ->update([
                        'error_code' => $code,
                        'error_message' => 'Your image request could not be submitted.',
                    ]);
            }

            throw $exception;
        }

        if (Validator::make($generationRaw, [
            'id' => ['required', 'string', 'regex:/\Agen_[a-zA-Z0-9]+\z/'],
            'status' => ['required', Rule::in(config('pixelforge.statuses'))],
            'rates' => ['required', 'array'],
            'created_at' => ['required', 'date'],
            'started_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'metadata.generation_uuid' => ['required', Rule::in([$submission['uuid']])],
        ])->fails()) {
            throw new PixelforgeApiException('invalid_response', retryable: true, mayHaveBeenAccepted: true);
        }

        $this->updateGenerationFromProvider($generationId, $generationRaw);
    }

    /** @param array<string, mixed> $event */
    public function handleGenerationWebhook(array $event): void
    {
        DB::transaction(function () use ($event): void {
            $inserted = WebhookEvent::query()
                ->insertOrIgnore([
                    'provider_event_id' => $event['id'],
                    'type' => $event['type'],
                    'payload' => json_encode($event, JSON_THROW_ON_ERROR),
                    'occurred_at' => $event['created_at'],
                ]);

            if ($inserted === 0) {
                return;
            }

            $generation = null;

            if ($event['type'] !== 'ping') {
                $webhookGeneration = $event['data']['object'];
                $generation = Generation::query()
                    ->where('provider_generation_id', $webhookGeneration['id'])
                    ->lockForUpdate()
                    ->first();

                $submissionKey = $webhookGeneration['metadata']['generation_uuid'] ?? null;
                if ($generation === null && $submissionKey !== null) {
                    $generation = Generation::query()
                        ->where('uuid', $submissionKey)
                        ->whereNull('provider_generation_id')
                        ->lockForUpdate()
                        ->first();
                }

                if ($generation !== null) {
                    $this->updateGenerationFromProvider($generation->id, $webhookGeneration);
                }
            }

            WebhookEvent::query()
                ->where('provider_event_id', $event['id'])
                ->update([
                    'generation_id' => $generation?->id,
                    'processed_at' => now(),
                ]);
        });
    }

    public function syncGenerations(): void
    {
        $cursor = null;
        $seenCursors = [];

        do {
            $generationsRaw = $this->pixelforge->getGenerations($cursor);

            foreach ($generationsRaw['data'] as $providerGeneration) {
                $this->syncGeneration($providerGeneration);
            }

            $cursor = $generationsRaw['has_more'] ? $generationsRaw['next_cursor'] : null;
            if ($cursor !== null) {
                if (isset($seenCursors[$cursor])) {
                    throw new PixelforgeApiException('invalid_response', retryable: true);
                }
                $seenCursors[$cursor] = true;
            }
        } while ($cursor !== null);
    }

    /** @param array<string, mixed> $providerGeneration */
    private function syncGeneration(array $providerGeneration): void
    {
        DB::transaction(function () use ($providerGeneration): void {
            $generation = Generation::query()
                ->where('provider_generation_id', $providerGeneration['id'])
                ->lockForUpdate()
                ->first();

            $submissionKey = $providerGeneration['metadata']['generation_uuid'] ?? null;
            if (! is_string($submissionKey) || ! Str::isUuid($submissionKey)) {
                $submissionKey = null;
            }

            if ($generation === null && $submissionKey !== null) {
                $generation = Generation::query()
                    ->where('uuid', $submissionKey)
                    ->whereNull('provider_generation_id')
                    ->lockForUpdate()
                    ->first();
            }

            if ($generation === null) {
                return;
            }

            $this->updateGenerationFromProvider($generation->id, $providerGeneration);
        });
    }

    /** @param array<string, mixed> $providerGeneration */
    private function updateGenerationFromProvider(int $generationId, array $providerGeneration): void
    {
        DB::transaction(function () use ($generationId, $providerGeneration): void {
            $generation = Generation::query()
                ->lockForUpdate()
                ->findOrFail($generationId);

            if ($generation->provider_generation_id !== null && $generation->provider_generation_id !== $providerGeneration['id']) {
                throw new LogicException('Pixelforge submission key is already linked to another generation.');
            }

            if (in_array($generation->status, ['succeeded', 'failed'], true)) {
                if ($generation->provider_generation_id === $providerGeneration['id'] && $generation->status === $providerGeneration['status']) {
                    $generation->fill([
                        'provider_created_at' => GenerationHelper::utcTimestamp($providerGeneration['created_at']),
                        'started_at' => GenerationHelper::utcTimestamp($providerGeneration['started_at'] ?? null),
                        'completed_at' => GenerationHelper::utcTimestamp($providerGeneration['completed_at']),
                    ]);

                    if ($generation->isDirty()) {
                        $generation->save();
                    }
                }

                return;
            }

            if ($generation->status === 'processing' && $providerGeneration['status'] === 'queued') {
                return;
            }

            $changes = [
                'provider_generation_id' => $providerGeneration['id'],
                'provider_rates' => $providerGeneration['rates'],
                'provider_created_at' => GenerationHelper::utcTimestamp($providerGeneration['created_at']),
                'started_at' => GenerationHelper::utcTimestamp($providerGeneration['started_at'] ?? null),
                'status' => $providerGeneration['status'],
                'error_code' => null,
                'error_message' => null,
            ];

            if ($providerGeneration['status'] === 'succeeded') {
                $usage = $providerGeneration['usage'];
                $providerCost = GenerationHelper::calculateCost($usage, $providerGeneration['rates']);
                $actualCost = (string) BigDecimal::of($providerCost)->multipliedBy($generation->pricing_snapshot['price_multiplier']);

                $changes += [
                    'input_text_tokens' => $usage['input_text_tokens'],
                    'input_image_tokens' => $usage['input_image_tokens'],
                    'output_tokens' => $usage['output_tokens'],
                    'reasoning_tokens' => $usage['reasoning_tokens'],
                    'provider_cost' => $providerCost,
                    'actual_cost' => $actualCost,
                    'image_url' => $providerGeneration['image_url'],
                    'image_url_expires_at' => GenerationHelper::utcTimestamp($providerGeneration['image_url_expires_at']),
                    'completed_at' => GenerationHelper::utcTimestamp($providerGeneration['completed_at']),
                ];
            }

            if ($providerGeneration['status'] === 'failed') {
                $changes = array_replace($changes, [
                    'provider_cost' => '0',
                    'actual_cost' => '0',
                    'completed_at' => GenerationHelper::utcTimestamp($providerGeneration['completed_at']),
                    'error_code' => $providerGeneration['error']['code'],
                    'error_message' => 'We couldn’t generate this image. You weren’t charged.',
                ]);
            }

            $generation->update($changes);

            if (in_array($providerGeneration['status'], ['succeeded', 'failed'], true)) {
                $this->transactions->settleGeneration($generation->id);
            }
        });
    }

    private function queueSubmission(int $generationId): void
    {
        if (! Generation::query()
            ->whereKey($generationId)
            ->where('status', 'pending')
            ->whereNull('provider_generation_id')
            ->exists()) {
            return;
        }

        try {
            SubmitGenerationJob::dispatch($generationId, $this)->afterCommit();
        } catch (Throwable $exception) {
            report($exception);
            throw ValidationException::withMessages([
                'submissionKey' => 'We couldn’t queue your image. Please try again.',
            ]);
        }
    }

    public function resolveUncertainSubmission(string $uuid): void
    {
        Validator::make([
            'uuid' => $uuid,
        ], [
            'uuid' => ['required', 'uuid'],
        ])->validate();

        $generationId = Generation::query()
            ->where('uuid', $uuid)
            ->value('id');

        if ($generationId === null) {
            throw ValidationException::withMessages([
                'generation' => 'Generation not found.',
            ]);
        }

        // Use the worker's actual middleware key so resolution cannot race an in-flight submission.
        $job = new SubmitGenerationJob($generationId, $this);
        $middleware = $job->middleware()[0];
        $resolved = Cache::lock($middleware->getLockKey($job), $middleware->expiresAfter)->get(function () use ($generationId): bool {
            return DB::transaction(function () use ($generationId): bool {
                $generation = Generation::query()
                    ->whereKey($generationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($generation->status === 'failed' && $generation->error_code === 'submission_not_accepted') {
                    return true;
                }

                if ($generation->status !== 'pending' || $generation->provider_generation_id !== null || $generation->error_code !== 'submission_uncertain') {
                    throw ValidationException::withMessages([
                        'generation' => 'Only uncertain pending submissions without a provider ID can be resolved manually.',
                    ]);
                }

                $generation->update([
                    'status' => 'failed',
                    'provider_cost' => '0',
                    'actual_cost' => '0',
                    'completed_at' => now(),
                    'error_code' => 'submission_not_accepted',
                    'error_message' => 'Your image request was not accepted. Your reserved credits have been released. Please try again.',
                ]);

                $this->transactions->settleGeneration($generationId);

                Log::notice('Submission manually confirmed as not accepted by Pixelforge.', [
                    'generation_id' => $generationId,
                    'generation_uuid' => $generation->uuid,
                ]);

                return true;
            });
        });

        if (! $resolved) {
            throw ValidationException::withMessages([
                'generation' => 'A submission attempt is running. Wait for it to finish before resolving this generation.',
            ]);
        }
    }

    public function handleSubmissionFailure(int $generationId): void
    {
        DB::transaction(function () use ($generationId): void {
            $generation = Generation::query()
                ->lockForUpdate()
                ->find($generationId);
            if ($generation === null || $generation->status !== 'pending' || $generation->provider_generation_id !== null) {
                return;
            }
            if ($generation->error_code !== null && ! in_array($generation->error_code, self::REJECTION_CODES, true)) {
                return;
            }

            Log::error($generation);
            $message = match ($generation->error_code) {
                'content_policy_violation' => 'Your prompt violates the content policy. Please revise it.',
                'daily_limit_exceeded' => 'Image generation has reached its daily limit. Please try again tomorrow.',
                default => 'Your image request could not be submitted. Please try again.',
            };

            $generation->update([
                'status' => 'failed',
                'provider_cost' => '0',
                'actual_cost' => '0',
                'completed_at' => now(),
                'error_code' => $generation->error_code ?? 'submission_failed',
                'error_message' => $message,
            ]);

            $this->transactions->settleGeneration($generation->id);
        });
    }
}
