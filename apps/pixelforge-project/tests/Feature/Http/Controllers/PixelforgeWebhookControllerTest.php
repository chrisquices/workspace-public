<?php

use Database\Factories\GenerationFactory;
use Database\Factories\TransactionFactory;
use Illuminate\Testing\TestResponse;
use Tests\Fixtures\Pixelforge;

function deliverWebhook(array $event): TestResponse
{
    $body = json_encode($event, JSON_THROW_ON_ERROR);

    return test()->call('POST', '/webhooks/pixelforge', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_PIXELFORGE_SIGNATURE' => Pixelforge::signature($body),
    ], $body);
}

it('returns 403 for missing invalid or expired webhook signatures', function (?string $secret, int $offset) {
    $generation = GenerationFactory::new()->create();
    $body = json_encode(Pixelforge::event(Pixelforge::generation($generation)), JSON_THROW_ON_ERROR);
    $signature = $secret === null ? '' : Pixelforge::signature($body, $offset, $secret);

    $this->call('POST', '/webhooks/pixelforge', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_PIXELFORGE_SIGNATURE' => $signature,
    ], $body)->assertForbidden();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
    ]);
    $this->assertDatabaseCount('webhook_events', 0);
    $this->assertDatabaseCount('transactions', 0);
})->with([
    'missing' => [null, 0],
    'invalid secret' => ['wrong-secret', 0],
    'expired' => ['test-webhook-secret', -601],
    'future timestamp' => ['test-webhook-secret', 601],
]);

it('stores successful completion with exact costs and one ledger charge', function () {
    $generation = GenerationFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $generation->user_id,
    ]);
    $event = Pixelforge::event(Pixelforge::generation($generation));

    deliverWebhook($event)->assertNoContent();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'succeeded',
        'provider_cost' => '0.064200000000',
        'actual_cost' => '0.080250000000',
        'reserved_amount' => '0.000000000000',
        'image_url' => 'https://provider.test/image.png',
        'input_text_tokens' => 10,
        'input_image_tokens' => 765,
        'output_tokens' => 1100,
        'reasoning_tokens' => 1000,
    ]);
    $this->assertDatabaseHas('transactions', [
        'generation_id' => $generation->id,
        'user_id' => $generation->user_id,
        'amount' => '-0.080250000000',
    ]);
    $this->assertDatabaseCount('transactions', 2);
    $this->assertDatabaseHas('webhook_events', [
        'provider_event_id' => $event['id'],
        'generation_id' => $generation->id,
    ]);
    expect($generation->fresh()->completed_at->utc()->toIso8601String())->toBe('2026-11-17T23:59:59+00:00');
});

it('releases the reservation without charging for a failed generation', function () {
    $generation = GenerationFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $generation->user_id,
    ]);

    deliverWebhook(Pixelforge::event(Pixelforge::generation($generation, 'failed')))->assertNoContent();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'failed',
        'provider_cost' => '0',
        'actual_cost' => '0',
        'reserved_amount' => '0',
        'error_code' => 'generation_failed',
    ]);
    $this->assertDatabaseCount('transactions', 1);
});

it('does not charge twice for duplicate completion notifications', function (bool $sameEventId) {
    $generation = GenerationFactory::new()->create();
    $event = Pixelforge::event(Pixelforge::generation($generation));
    deliverWebhook($event)->assertNoContent();
    $repeated = $sameEventId ? $event : Pixelforge::event($event['data']['object']);

    deliverWebhook($repeated)->assertNoContent();

    $this->assertDatabaseCount('transactions', 1);
    $this->assertDatabaseHas('transactions', [
        'generation_id' => $generation->id,
        'amount' => '-0.08025',
    ]);
    $this->assertDatabaseCount('webhook_events', $sameEventId ? 1 : 2);
})->with([
    'same event' => true,
    'new event ID for same completion' => false,
]);

it('does not regress a completed generation when an unseen processing event arrives', function () {
    $generation = GenerationFactory::new()->create();
    deliverWebhook(Pixelforge::event(Pixelforge::generation($generation)))->assertNoContent();

    deliverWebhook(Pixelforge::event(Pixelforge::generation($generation, 'processing')))->assertNoContent();

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'succeeded',
        'provider_cost' => '0.0642',
        'actual_cost' => '0.08025',
        'image_url' => 'https://provider.test/image.png',
    ]);
    $this->assertDatabaseCount('transactions', 1);
    $this->assertDatabaseCount('webhook_events', 2);
});

it('returns 422 without settling a signed but malformed completion', function () {
    $generation = GenerationFactory::new()->create();
    $event = Pixelforge::event(Pixelforge::generation($generation));
    $event['data']['object']['usage']['output_tokens'] = -1;

    deliverWebhook($event)->assertUnprocessable()->assertJsonValidationErrors('data.object.usage.output_tokens');

    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'status' => 'pending',
    ]);
    $this->assertDatabaseCount('transactions', 0);
    $this->assertDatabaseCount('webhook_events', 0);
});
