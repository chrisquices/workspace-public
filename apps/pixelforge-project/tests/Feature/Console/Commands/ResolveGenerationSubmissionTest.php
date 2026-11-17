<?php

use App\Jobs\SubmitGenerationJob;
use App\Services\GenerationService;
use App\Services\TransactionService;
use Database\Factories\GenerationFactory;
use Database\Factories\TransactionFactory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Fixtures\Pixelforge;

it('requires explicit confirmation before releasing uncertain credits', function () {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
    ])
        ->expectsOutput('Verify that Pixelforge never accepted this submission, then pass --confirmed-not-accepted. A timeout or missing webhook is not confirmation.')
        ->assertFailed();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'reserved_amount' => '0.1',
        'completed_at' => null,
    ]);
    Http::assertNothingSent();
});

it('releases a confirmed unaccepted reservation once and prevents delayed retries from submitting', function () {
    Log::spy();
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    TransactionFactory::new()->create([
        'user_id' => $generation->user_id,
    ]);
    $transactions = app(TransactionService::class);
    expect($transactions->getSpendableBalance($generation->user_id))->toBe('4.900000000000');

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
        '--confirmed-not-accepted' => true,
    ])->expectsOutput('Submission marked failed; reserved credits released without a charge.')->assertSuccessful();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'failed',
        'provider_generation_id' => null,
        'error_code' => 'submission_not_accepted',
        'reserved_amount' => '0',
        'provider_cost' => '0',
        'actual_cost' => '0',
    ]);
    expect($generation->fresh()->completed_at)->not->toBeNull();
    expect($transactions->getSpendableBalance($generation->user_id))->toBe('5.000000000000');
    $this->assertDatabaseCount('transactions', 1);
    Log::shouldHaveReceived('notice')->once()->with('Submission manually confirmed as not accepted by Pixelforge.', [
        'generation_id' => $generation->id,
        'generation_uuid' => $generation->uuid,
    ]);

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
        '--confirmed-not-accepted' => true,
    ])->assertSuccessful();
    $job = (new SubmitGenerationJob($generation->id, app(GenerationService::class)))->withFakeQueueInteractions();
    $job->handle();
    $job->assertNotFailed()->assertNotReleased();

    expect($transactions->getSpendableBalance($generation->user_id))->toBe('5.000000000000');
    $this->assertDatabaseCount('transactions', 1);
    Http::assertNothingSent();
});

it('refuses resolution while a queue worker holds the submission lock', function () {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    $job = new SubmitGenerationJob($generation->id, app(GenerationService::class));

    $job->middleware()[0]->handle($job, function () use ($generation) {
        $this->artisan('generations:resolve-submission', [
            'uuid' => $generation->uuid,
            '--confirmed-not-accepted' => true,
        ])->expectsOutput('A submission attempt is running. Wait for it to finish before resolving this generation.')->assertFailed();
    });

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
        'reserved_amount' => '0.1',
        'error_code' => 'submission_uncertain',
    ]);
    $this->assertDatabaseCount('transactions', 0);
});

it('refuses submissions that are not uncertain and unlinked', function (array $attributes) {
    $generation = GenerationFactory::new()->create($attributes);

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
        '--confirmed-not-accepted' => true,
    ])->expectsOutput('Only uncertain pending submissions without a provider ID can be resolved manually.')->assertFailed();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => $generation->status,
        'reserved_amount' => '0.1',
        'completed_at' => null,
    ]);
    $this->assertDatabaseCount('transactions', 0);
})->with([
    'not yet attempted' => [[
        'error_code' => null,
    ]],
    'definitive rejection' => [[
        'error_code' => 'overloaded',
    ]],
    'linked pending' => [[
        'error_code' => 'submission_uncertain',
        'provider_generation_id' => 'gen_known',
    ]],
    'processing' => [[
        'status' => 'processing',
        'provider_generation_id' => 'gen_known',
    ]],
]);

it('preserves a charge when a webhook settles the generation before manual resolution', function () {
    $generation = GenerationFactory::new()->create([
        'error_code' => 'submission_uncertain',
    ]);
    app(GenerationService::class)->handleGenerationWebhook(Pixelforge::event(Pixelforge::generation($generation)));

    $this->artisan('generations:resolve-submission', [
        'uuid' => $generation->uuid,
        '--confirmed-not-accepted' => true,
    ])->assertFailed();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'succeeded',
        'actual_cost' => '0.08025',
    ]);
    $this->assertDatabaseHas('transactions', [
        'generation_id' => $generation->id,
        'amount' => '-0.08025',
    ]);
    $this->assertDatabaseCount('transactions', 1);
});

it('reports an unknown generation without changing data', function () {
    $this->artisan('generations:resolve-submission', [
        'uuid' => (string) Str::uuid(),
        '--confirmed-not-accepted' => true,
    ])->expectsOutput('Generation not found.')->assertFailed();

    $this->assertDatabaseCount('generations', 0);
    $this->assertDatabaseCount('transactions', 0);
});
