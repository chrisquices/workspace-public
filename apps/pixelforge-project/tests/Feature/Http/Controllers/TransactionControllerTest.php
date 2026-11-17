<?php

use Database\Factories\UserFactory;
use Illuminate\Support\Str;

it('credits the signed in user five dollars once for a repeated purchase key', function () {
    $user = UserFactory::new()->create();
    $other = UserFactory::new()->create();
    $payload = [
        'transactionKey' => (string) Str::uuid(),
        'amount' => '999',
        'user_id' => $other->id,
    ];
    $this->actingAs($user)->post('/transactions', $payload)->assertRedirect('/generations');

    $this->post('/transactions', $payload)->assertRedirect('/generations');

    $this->assertDatabaseCount('transactions', 1);
    $this->assertDatabaseHas('transactions', [
        'uuid' => $payload['transactionKey'],
        'user_id' => $user->id,
        'generation_id' => null,
        'amount' => '5',
    ]);
});
