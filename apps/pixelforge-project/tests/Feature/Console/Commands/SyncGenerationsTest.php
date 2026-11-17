<?php

use Database\Factories\GenerationFactory;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Pixelforge;

it('skips unknown records and recovers known generations across pages with multiple users', function () {
    $user = UserFactory::new()->create();
    UserFactory::new()->create();
    $known = GenerationFactory::new()->create([
        'user_id' => $user->id,
        'provider_generation_id' => 'gen_known',
    ]);
    $unconfirmed = GenerationFactory::new()->create([
        'user_id' => $user->id,
        'error_code' => 'submission_uncertain',
    ]);
    $unknown = GenerationFactory::new()->make([
        'user_id' => $user->id,
    ]);
    Http::fake([
        'https://provider.test/v1/generations?limit=100' => Http::response(Pixelforge::page([Pixelforge::generation($unknown), Pixelforge::generation($known)], 'page2')),
        'https://provider.test/v1/generations?limit=100&cursor=page2' => Http::response(Pixelforge::page([Pixelforge::generation($unconfirmed)])),
    ]);

    $this->artisan('generations:sync')->expectsOutput('Generations synced.')->assertSuccessful();

    $this->assertDatabaseCount('generations', 2);
    $this->assertDatabaseMissing('generations', [
        'uuid' => $unknown->uuid,
    ]);
    $this->assertDatabaseHas('generations', [
        'id' => $known->id,
        'user_id' => $user->id,
        'status' => 'succeeded',
        'actual_cost' => '0.08025',
        'reserved_amount' => '0',
    ]);
    $this->assertDatabaseHas('generations', [
        'id' => $unconfirmed->id,
        'user_id' => $user->id,
        'status' => 'succeeded',
        'provider_generation_id' => Pixelforge::generation($unconfirmed)['id'],
        'error_code' => null,
    ]);
    $this->assertDatabaseCount('transactions', 2);
    $this->assertDatabaseCount('webhook_events', 0);
    Http::assertSentCount(2);
});

it('does not import unknown records even when zero or one user exists', function (int $userCount) {
    UserFactory::new()->count($userCount)->create();
    $unknown = GenerationFactory::new()->make([
        'user_id' => 1,
    ]);
    Http::fake([
        'https://provider.test/v1/generations?limit=100' => Http::response(Pixelforge::page([Pixelforge::generation($unknown)])),
    ]);

    $this->artisan('generations:sync')->assertSuccessful();

    $this->assertDatabaseCount('generations', 0);
    $this->assertDatabaseCount('transactions', 0);
    Http::assertSentCount(1);
})->with([
    'no users' => 0,
    'one user' => 1,
]);

it('keeps one charge when sync repeats a completed generation', function () {
    $generation = GenerationFactory::new()->create([
        'provider_generation_id' => 'gen_repeat',
    ]);
    Http::fake([
        'https://provider.test/v1/generations?limit=100' => Http::response(Pixelforge::page([Pixelforge::generation($generation)])),
    ]);
    $this->artisan('generations:sync')->assertSuccessful();

    $this->artisan('generations:sync')->assertSuccessful();

    $this->assertDatabaseCount('transactions', 1);
    $this->assertDatabaseHas('transactions', [
        'generation_id' => $generation->id,
        'amount' => '-0.08025',
    ]);
    Http::assertSentCount(2);
});

it('skips a conflicting provider ID without replacing the known generation owner or link', function () {
    $generation = GenerationFactory::new()->create([
        'provider_generation_id' => 'gen_original',
    ]);
    $conflicting = Pixelforge::generation($generation, overrides: [
        'id' => 'gen_other',
    ]);
    Http::fake([
        'https://provider.test/v1/generations?limit=100' => Http::response(Pixelforge::page([$conflicting, Pixelforge::generation($generation)])),
    ]);

    $this->artisan('generations:sync')->assertSuccessful();

    $this->assertDatabaseCount('generations', 1);
    $this->assertDatabaseHas('generations', [
        'id' => $generation->id,
        'user_id' => $generation->user_id,
        'provider_generation_id' => 'gen_original',
        'status' => 'succeeded',
    ]);
    $this->assertDatabaseCount('transactions', 1);
    Http::assertSentCount(1);
});
