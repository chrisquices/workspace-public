<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('generations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('provider_generation_id')->nullable()->unique();
            $table->enum('status', ['pending', 'queued', 'processing', 'succeeded', 'failed'])->default('pending');
            $table->text('prompt');
            $table->enum('size', ['1024x1024', '1536x1024', '1024x1536']);
            $table->enum('quality', ['low', 'medium', 'high']);
            $table->jsonb('reference_images');
            $table->jsonb('pricing_snapshot');
            $table->jsonb('provider_rates')->nullable();
            $table->bigInteger('input_text_tokens')->nullable();
            $table->bigInteger('input_image_tokens')->nullable();
            $table->bigInteger('output_tokens')->nullable();
            $table->bigInteger('reasoning_tokens')->nullable();
            $table->decimal('estimated_cost', 20, 12)->comment('Estimated user charge in USD, including the 25% markup.');
            $table->decimal('reserved_amount', 20, 12)->default(0)->comment('User credits held in USD until this generation settles.');
            $table->decimal('provider_cost', 20, 12)->nullable()->comment('Actual provider cost in USD.');
            $table->decimal('actual_cost', 20, 12)->nullable()->comment('Actual user charge in USD, including the 25% markup.');
            $table->text('image_url')->nullable();
            $table->timestampTz('image_url_expires_at')->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampTz('provider_created_at')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['id', 'user_id']);
            $table->index(['user_id', 'created_at']);
            $table->index(['completed_at', 'user_id']);
            $table->index(['status', 'updated_at']);
        });

        DB::statement('ALTER TABLE generations ADD CONSTRAINT generations_nonnegative_reserved_amount CHECK (reserved_amount >= 0)');

        DB::statement(<<<'SQL'
            ALTER TABLE generations
                ADD CONSTRAINT generations_nonnegative_amounts CHECK (
                    estimated_cost >= 0 AND provider_cost >= 0 AND actual_cost >= 0
                )
            SQL);

        DB::statement(<<<'SQL'
            ALTER TABLE generations
                ADD CONSTRAINT generations_nonnegative_usage CHECK (
                    input_text_tokens >= 0 AND input_image_tokens >= 0
                    AND output_tokens >= 0 AND reasoning_tokens >= 0
                )
            SQL);

        DB::statement(<<<'SQL'
            ALTER TABLE generations
                ADD CONSTRAINT generations_settlement CHECK (
                    (status IN ('pending', 'queued', 'processing')
                        AND provider_cost IS NULL AND actual_cost IS NULL AND completed_at IS NULL)
                    OR (status = 'succeeded'
                        AND provider_generation_id IS NOT NULL AND provider_rates IS NOT NULL
                        AND input_text_tokens IS NOT NULL AND input_image_tokens IS NOT NULL
                        AND output_tokens IS NOT NULL AND reasoning_tokens IS NOT NULL
                        AND provider_cost IS NOT NULL AND actual_cost IS NOT NULL
                        AND actual_cost = provider_cost * 1.25 AND completed_at IS NOT NULL)
                    OR (status = 'failed'
                        AND provider_cost IS NOT NULL AND actual_cost IS NOT NULL
                        AND provider_cost = 0 AND actual_cost = 0 AND completed_at IS NOT NULL)
                )
            SQL);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('generations');
    }
};
