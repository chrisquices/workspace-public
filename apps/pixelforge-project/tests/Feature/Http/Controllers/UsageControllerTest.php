<?php

use App\Services\GenerationService;
use Database\Factories\GenerationFactory;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Inertia\Testing\AssertableInertia;
use Tests\Fixtures\Pixelforge;

it('reports exact spend cost and profit per user and UTC completion date', function () {
    $first = UserFactory::new()->create();
    $second = UserFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $first->id,
    ]);
    $service = app(GenerationService::class);
    foreach ([[$first, '2026-11-17T23:59:59Z'], [$second, '2026-11-18T02:59:59+03:00'], [$first, '2026-11-18T00:00:00Z']] as [$user, $completedAt]) {
        $generation = GenerationFactory::new()->create([
            'user_id' => $user->id,
        ]);
        $service->handleGenerationWebhook(Pixelforge::event(Pixelforge::generation($generation, overrides: [
            'completed_at' => $completedAt,
        ])));
    }
    $failed = GenerationFactory::new()->create([
        'user_id' => $first->id,
    ]);
    $service->handleGenerationWebhook(Pixelforge::event(Pixelforge::generation($failed, 'failed')));

    $this->actingAs($first)->get('/usage?startDate=2026-11-17&endDate=2026-11-17')->assertInertia(function (AssertableInertia $page) use ($first, $second) {
        $page->component('Usages/Index')->has('usages', 2)
            ->where('usages.0.date', '2026-11-17')->where('usages.0.userId', $first->id)
            ->where('usages.0.creditSpend', '0.080250000000')->where('usages.0.providerCost', '0.064200000000')->where('usages.0.profit', '0.016050000000')
            ->where('usages.1.userId', $second->id)->where('usages.1.providerCost', '0.064200000000');
    });
});

it('limits the usage report to the selected user and includes the end date', function () {
    $user = UserFactory::new()->create();
    $other = UserFactory::new()->create();
    foreach ([$user, $other] as $owner) {
        $generation = GenerationFactory::new()->create([
            'user_id' => $owner->id,
        ]);
        app(GenerationService::class)->handleGenerationWebhook(Pixelforge::event(Pixelforge::generation($generation)));
    }

    $this->actingAs($user)->get('/usage?startDate=2026-11-16&endDate=2026-11-17&userId='.$other->id)->assertInertia(function (AssertableInertia $page) use ($other) {
        $page->component('Usages/Index')->has('usages', 1)->where('usages.0.userId', $other->id)->where('usages.0.date', '2026-11-17');
    });
});
