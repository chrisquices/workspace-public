<?php

use App\Exceptions\PixelforgeApiException;
use App\Jobs\SubmitGenerationJob;
use App\Services\GenerationService;
use Database\Factories\GenerationFactory;
use Illuminate\Queue\Jobs\FakeJob;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Pixelforge;

it('submits with the generation UUID as provider idempotency key', function () {
    $generation = GenerationFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/generations' => Http::response(Pixelforge::generation($generation, 'queued'), 202),
    ]);
    $job = (new SubmitGenerationJob($generation->id, app(GenerationService::class)))->withFakeQueueInteractions();

    $job->handle();

    $job->assertNotFailed()->assertNotReleased();
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'queued',
        'provider_generation_id' => Pixelforge::generation($generation)['id'],
        'error_code' => null,
    ]);
    Http::assertSent(function ($request) use ($generation) {
        return $request->hasHeader('Idempotency-Key', $generation->uuid)
            && ((array) $request['metadata'])['generation_uuid'] === $generation->uuid;
    });
});

it('releases overloaded submissions with backoff until the attempt limit', function (int $attempt, int $delay) {
    $generation = GenerationFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/generations' => Http::response([
            'error' => [
                'code' => 'overloaded',
            ],
        ], 503, [
            'Retry-After' => '10',
        ]),
    ]);
    $job = new SubmitGenerationJob($generation->id, app(GenerationService::class));
    $queueJob = new FakeJob;
    $queueJob->attempts = $attempt;
    $job->setJob($queueJob);

    $job->handle();

    $job->assertReleased($delay)->assertNotFailed();
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'provider_generation_id' => null,
        'error_code' => 'overloaded',
        'reserved_amount' => '0.1',
    ]);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
})->with([
    'first attempt respects Retry-After' => [1, 10],
    'last retry uses backoff' => [7, 600],
]);

it('fails an overloaded submission after eight attempts and releases its credits', function () {
    $generation = GenerationFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/generations' => Http::response([
            'error' => [
                'code' => 'overloaded',
            ],
        ], 503, [
            'Retry-After' => '10',
        ]),
    ]);
    $job = new SubmitGenerationJob($generation->id, app(GenerationService::class));
    $queueJob = new FakeJob;
    $queueJob->attempts = 8;
    $job->setJob($queueJob);

    $job->handle();
    $job->assertFailedWith(PixelforgeApiException::class)->assertNotReleased();

    // FakeJob records failure; the real queue worker invokes this callback.
    $job->failed($queueJob->failedWith);

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'failed',
        'reserved_amount' => '0',
        'provider_cost' => '0',
        'actual_cost' => '0',
        'error_code' => 'overloaded',
    ]);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
});

it('fails blocked prompts immediately without retrying or charging', function () {
    $generation = GenerationFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/generations' => Http::response([
            'error' => [
                'code' => 'content_policy_violation',
            ],
        ], 422),
    ]);
    $job = (new SubmitGenerationJob($generation->id, app(GenerationService::class)))->withFakeQueueInteractions();

    $job->handle();
    $job->assertFailedWith(PixelforgeApiException::class)->assertNotReleased();
    $job->failed($job->job->failedWith);

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'failed',
        'error_code' => 'content_policy_violation',
        'reserved_amount' => '0',
        'actual_cost' => '0',
    ]);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
});

it('keeps uncertain credits reserved after exhausted network retries until manually confirmed', function () {
    $generation = GenerationFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/generations' => Http::failedConnection(),
    ]);
    $job = new SubmitGenerationJob($generation->id, app(GenerationService::class));
    $queueJob = new FakeJob;
    $queueJob->attempts = 8;
    $job->setJob($queueJob);

    $job->handle();
    $job->assertFailedWith(PixelforgeApiException::class)->assertNotReleased();
    $job->failed($queueJob->failedWith);

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'provider_generation_id' => null,
        'error_code' => 'submission_uncertain',
        'reserved_amount' => '0.1',
        'actual_cost' => null,
    ]);

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
        '--confirmed-not-accepted' => true,
    ])->assertSuccessful();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'failed',
        'reserved_amount' => '0',
        'actual_cost' => '0',
    ]);
    $this->assertDatabaseCount('transactions', 0);
});

it('settles a completed idempotent replay without waiting for a webhook or sync', function (string $status, string $cost, int $charges) {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    Http::fake([
        'https://provider.test/v1/generations' => Http::response(Pixelforge::generation($generation, $status), 202),
    ]);
    $job = (new SubmitGenerationJob($generation->id, app(GenerationService::class)))->withFakeQueueInteractions();

    $job->handle();

    $job->assertNotFailed()->assertNotReleased();
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => $status,
        'provider_generation_id' => Pixelforge::generation($generation)['id'],
        'reserved_amount' => '0',
        'actual_cost' => $cost,
    ]);
    expect($generation->fresh()->completed_at)->not->toBeNull();
    $this->assertDatabaseCount('transactions', $charges);

    $job->handle();

    $this->assertDatabaseCount('transactions', $charges);
    Http::assertSentCount(1);
    Http::assertSent(function ($request) use ($generation) {
        return $request->hasHeader('Idempotency-Key', $generation->uuid)
            && $request['prompt'] === $generation->prompt
            && ((array) $request['metadata'])['generation_uuid'] === $generation->uuid;
    });
})->with([
    'succeeded replay' => ['succeeded', '0.08025', 1],
    'failed replay' => ['failed', '0', 0],
]);

it('keeps a malformed completed replay uncertain without charging', function () {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    Http::fake([
        'https://provider.test/v1/generations' => Http::response(Pixelforge::generation($generation, overrides: [
            'usage' => null,
        ]), 202),
    ]);
    $job = (new SubmitGenerationJob($generation->id, app(GenerationService::class)))->withFakeQueueInteractions();

    $job->handle();

    $job->assertReleased(5)->assertNotFailed();
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'provider_generation_id' => null,
        'error_code' => 'submission_uncertain',
        'reserved_amount' => '0.1',
        'actual_cost' => null,
    ]);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
});

it('does not treat authentication or rate limits on a replay as proof of non-acceptance', function (int $status, string $code) {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    Http::fake([
        'https://provider.test/v1/generations' => Http::response([
            'error' => [
                'code' => $code,
            ],
        ], $status, [
            'Retry-After' => '10',
        ]),
    ]);
    $job = new SubmitGenerationJob($generation->id, app(GenerationService::class));
    $queueJob = new FakeJob;
    $queueJob->attempts = 8;
    $job->setJob($queueJob);

    $job->handle();
    $job->assertFailedWith(PixelforgeApiException::class)->assertNotReleased();
    $job->failed($queueJob->failedWith);

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'error_code' => 'submission_uncertain',
        'reserved_amount' => '0.1',
        'actual_cost' => null,
    ]);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
})->with([
    'revoked key' => [401, 'invalid_api_key'],
    'per-minute limit' => [429, 'rate_limit_exceeded'],
]);
