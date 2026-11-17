<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $uuid
 * @property string|null $provider_generation_id
 * @property array<string, mixed> $pricing_snapshot
 * @property string $status
 * @property string $prompt
 * @property string $size
 * @property string $quality
 * @property list<string> $reference_images
 * @property string $estimated_cost
 * @property string $reserved_amount
 * @property string|null $actual_cost
 * @property string|null $provider_cost
 * @property string|null $image_url
 * @property Carbon|null $image_url_expires_at
 * @property string|null $error_code
 * @property string|null $error_message
 * @property Carbon|null $created_at
 * @property Carbon|null $completed_at
 */
class Generation extends Model
{
    protected $table = 'generations';

    protected $guarded = ['id'];

    protected $fillable = [];

    protected $hidden = [];

    protected $casts = [
        'user_id' => 'integer',
        'reference_images' => 'array',
        'pricing_snapshot' => 'array',
        'provider_rates' => 'array',
        'input_text_tokens' => 'integer',
        'input_image_tokens' => 'integer',
        'output_tokens' => 'integer',
        'reasoning_tokens' => 'integer',
        'estimated_cost' => 'decimal:12',
        'reserved_amount' => 'decimal:12',
        'provider_cost' => 'decimal:12',
        'actual_cost' => 'decimal:12',
        'image_url_expires_at' => 'datetime',
        'provider_created_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

}
