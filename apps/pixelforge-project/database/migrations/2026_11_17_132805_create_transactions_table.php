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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique()->comment('Transaction request key used to prevent duplicate entries.');
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('generation_id')->nullable()->unique();
            $table->decimal('amount', 20, 12)->comment('Signed USD amount: positive credits and negative charges.');
            $table->timestampsTz();

            $table->index(['user_id', 'created_at']);
            $table->foreign(['generation_id', 'user_id'])->references(['id', 'user_id'])->on('generations')->restrictOnDelete();
        });

        DB::statement('ALTER TABLE transactions ADD CONSTRAINT transactions_nonzero_amount CHECK (amount <> 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
