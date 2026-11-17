<?php

namespace App\Http\Resources\Generation;

use App\Helpers\NumberHelper;
use App\Models\Generation;
use Brick\Math\RoundingMode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Generation */
class GenerationResource extends JsonResource
{

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $resource = $this->resource;

        $uuid = $resource->uuid;
        $providerGenerationId = $resource->provider_generation_id;
        $prompt = $resource->prompt;
        $size = $resource->size;
        $quality = $resource->quality;
        $status = $resource->status;
        $canBeDeleted = $status === 'failed' && $providerGenerationId === null;
        $referenceImages = $resource->reference_images;
        $estimatedCostFormatted = NumberHelper::formatNumberToCurrency($resource->estimated_cost, decimals: 4, roundingMode: RoundingMode::Ceiling);
        $actualCost = $resource->actual_cost;
        $actualCostDecimals = max(2, strlen(rtrim(explode('.', $actualCost ?? '')[1] ?? '', '0')));
        $actualCostFormatted = $actualCost === null ? 'Pending' : NumberHelper::formatNumberToCurrency($actualCost, decimals: 4);
        $imageUrl = $resource->image_url;
        $imageExpired = $resource->image_url_expires_at?->isPast() ?? false;
        $errorMessage = $resource->error_message;
        $metadata = [
            'dimensions' => str_replace('x', ' × ', $size),
            'quality' => ucfirst($quality),
            'estimatedCost' => $estimatedCostFormatted,
            'actualCost' => $actualCostFormatted,
            'created' => $resource->created_at?->utc()->format('F j, Y \a\t g:i A') ?? '—',
        ];

        return [
            'uuid' => $uuid,
            'providerGenerationId' => $providerGenerationId,
            'prompt' => $prompt,
            'size' => $size,
            'quality' => $quality,
            'status' => $status,
            'canBeDeleted' => $canBeDeleted,
            'referenceImages' => $referenceImages,
            'metadata' => $metadata,
            'imageUrl' => $imageUrl,
            'imageExpired' => $imageExpired,
            'errorMessage' => $errorMessage,
        ];
    }
}
