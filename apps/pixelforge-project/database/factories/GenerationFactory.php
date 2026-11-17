<?php

namespace Database\Factories;

use App\Models\Generation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Generation> */
class GenerationFactory extends Factory
{
    protected $model = Generation::class;

    public function definition(): array
    {
        $uuid = (string) Str::uuid();
        $userId = UserFactory::new();
        $status = 'pending';
        $prompt = 'tree';
        $size = '1024x1024';
        $quality = 'medium';
        $referenceImages = [];
        $pricingSnapshot = [
            'price_multiplier' => '1.25',
        ];
        $estimatedCost = '0.1';
        $reservedAmount = '0.1';

        return [
            'uuid' => $uuid,
            'user_id' => $userId,
            'status' => $status,
            'prompt' => $prompt,
            'size' => $size,
            'quality' => $quality,
            'reference_images' => $referenceImages,
            'pricing_snapshot' => $pricingSnapshot,
            'estimated_cost' => $estimatedCost,
            'reserved_amount' => $reservedAmount,
        ];
    }
}
