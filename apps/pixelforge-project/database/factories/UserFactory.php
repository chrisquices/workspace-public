<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        $name = fake()->name();
        $email = fake()->unique()->safeEmail();
        $emailVerifiedAt = now();
        $password = 'password';

        return [
            'name' => $name,
            'email' => $email,
            'email_verified_at' => $emailVerifiedAt,
            'password' => $password,
        ];
    }
}
