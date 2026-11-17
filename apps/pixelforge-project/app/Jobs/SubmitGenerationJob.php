<?php

namespace App\Jobs;

use App\Exceptions\PixelforgeApiException;
use App\Services\GenerationService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Validation\ValidationException;
use LogicException;
use Throwable;

class SubmitGenerationJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 8;
    public int $timeout = 75;
    public int $uniqueFor = 600;

    /** @var list<int> */
    public array $backoff = [5, 15, 30, 60, 120, 300, 600];

    public function __construct(public readonly int $generationId, private readonly GenerationService $generationService) {}

    public function uniqueId(): string
    {
        return (string) $this->generationId;
    }

    /** @return list<WithoutOverlapping> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('generation-submission:'.$this->generationId))->releaseAfter(10)->expireAfter(85)];
    }

    public function handle(): void
    {
        try {
            $this->generationService->submitGeneration($this->generationId);
        } catch (PixelforgeApiException $exception) {
            if (! $exception->retryable || $this->attempts() >= $this->tries) {
                $this->fail($exception);

                return;
            }

            $delay = $this->backoff[min($this->attempts() - 1, count($this->backoff) - 1)];
            $this->release(max($delay, $exception->retryAfter ?? 0));
        } catch (LogicException|ValidationException $exception) {
            $this->fail($exception);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->generationService->handleSubmissionFailure($this->generationId);
    }
}
