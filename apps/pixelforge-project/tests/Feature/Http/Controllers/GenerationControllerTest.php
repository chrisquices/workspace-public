<?php

use App\Jobs\SubmitGenerationJob;
use App\Models\Generation;
use Database\Factories\GenerationFactory;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia;
use Tests\Fixtures\Pixelforge;

it('creates and reserves one generation and queues its submission', function () {
    $user = UserFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $user->id,
    ]);
    Http::fake([
        'https://provider.test/v1/pricing' => Http::response(Pixelforge::pricing()),
    ]);
    Queue::fake();
    $payload = Pixelforge::submission();

    $this->actingAs($user)->postJson('/generations', $payload)->assertAccepted()->assertJson([
        'accepted' => true,
    ]);

    $generation = Generation::query()
        ->sole();
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'user_id' => $user->id,
        'uuid' => $payload['submissionKey'],
        'status' => 'pending',
        'estimated_cost' => '0.086262500000',
        'reserved_amount' => '0.086262500000',
    ]);
    $this->assertDatabaseCount('transactions', 1);
    Queue::assertPushed(SubmitGenerationJob::class, function ($job) use ($generation) {
        return $job->generationId === $generation->id;
    });
    Http::assertSentCount(1);
});

it('does not create another generation or reservation for the same submission key', function () {
    $user = UserFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $user->id,
    ]);
    Http::fake([
        'https://provider.test/v1/pricing' => Http::response(Pixelforge::pricing()),
    ]);
    Queue::fake();
    $payload = Pixelforge::submission();
    $this->actingAs($user)->postJson('/generations', $payload)->assertAccepted();

    $this->postJson('/generations', $payload)->assertAccepted();

    $this->assertDatabaseCount('generations', 1);
    $this->assertDatabaseHas('generations', [
        'uuid' => $payload['submissionKey'],
        'reserved_amount' => '0.086262500000',
    ]);
    Queue::assertPushedOnce(SubmitGenerationJob::class);
    Http::assertSentCount(1);
});

it('returns 422 without a generation or job when credits are insufficient', function () {
    $user = UserFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/pricing' => Http::response(Pixelforge::pricing()),
    ]);
    Queue::fake();

    $this->actingAs($user)->postJson('/generations', Pixelforge::submission())->assertUnprocessable()->assertJsonValidationErrors([
        'credits' => 'Insufficient credits.',
    ]);

    $this->assertDatabaseCount('generations', 0);
    $this->assertDatabaseCount('transactions', 0);
    Queue::assertNothingPushed();
    Http::assertSentCount(1);
});

it('returns 422 for invalid generation input before contacting the provider', function (array $overrides, string $field) {
    $user = UserFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/pricing' => Http::response(Pixelforge::pricing()),
    ]);
    Queue::fake();

    $this->actingAs($user)->postJson('/generations', Pixelforge::submission($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);

    $this->assertDatabaseCount('generations', 0);
    Queue::assertNothingPushed();
    Http::assertNothingSent();
})->with([
    'empty prompt' => [[
        'prompt' => '',
    ], 'prompt'],
    'unsupported size' => [[
        'size' => '1x1',
    ], 'size'],
    'unsupported quality' => [[
        'quality' => 'ultra',
    ], 'quality'],
    'invalid submission key' => [[
        'submissionKey' => 'not-a-uuid',
    ], 'submissionKey'],
]);

it('returns 401 for unauthenticated submissions', function () {
    Queue::fake();

    $this->postJson('/generations', Pixelforge::submission())->assertUnauthorized();

    $this->assertDatabaseCount('generations', 0);
    Queue::assertNothingPushed();
});

it('hides other users generations and returns 404 when attempting to delete them', function () {
    $user = UserFactory::new()->create();
    $own = GenerationFactory::new()->create([
        'user_id' => $user->id,
    ]);
    $other = GenerationFactory::new()->create();

    $this->actingAs($user)->get('/generations')->assertInertia(function (AssertableInertia $page) use ($own) {
        $page->component('Generations/Index')->has('generations', 1)->where('generations.0.uuid', $own->uuid);
    });
    $this->delete('/generations/'.$other->uuid)->assertNotFound();

    $this->assertModelExists($other);
});

it('does not allow another user to reuse a submission key', function () {
    $other = GenerationFactory::new()->create();
    $user = UserFactory::new()->create();
    Queue::fake();

    $this->actingAs($user)->postJson('/generations', Pixelforge::submission([
        'submissionKey' => $other->uuid,
    ]))->assertUnprocessable()->assertJsonValidationErrors('submissionKey');

    $this->assertDatabaseCount('generations', 1);
    $this->assertDatabaseHas('generations', [
        'id' => $other->id,
        'user_id' => $other->user_id,
    ]);
    Queue::assertNothingPushed();
});

it('includes reference image costs and markup in the estimate', function () {
    $user = UserFactory::new()->create();
    Http::fake([
        'https://provider.test/v1/pricing' => Http::response(Pixelforge::pricing()),
    ]);

    $this->actingAs($user)->postJson('/generations/estimate', [
        'prompt' => 'tree',
        'size' => '1024x1024',
        'quality' => 'medium',
        'referenceImageCount' => 1,
    ])
        ->assertOk()->assertJsonPath('estimate.minPriceUsd', '0.06768750000')->assertJsonPath('estimate.maxPriceUsd', '0.09582500000');

    Http::assertSentCount(1);
});
