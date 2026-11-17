<?php

namespace Database\Seeders;

use App\Services\UserService;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function __construct(private readonly UserService $userService) {}

    public function run(): void
    {
        $users = [
            [
                'name' => 'Default User',
                'email' => 'user@email.com',
                'password' => '$2y$12$RRNRvgEu6otXgxIDUt8IGeM6yCEaNub/0UZPGBDxmoUn8HO3sC04C',
                'is_superadmin' => false,
            ],
        ];

        foreach ($users as $user) {
            $this->userService->store($user['name'], $user['email'], $user['password'], $user['is_superadmin']);
        }
    }
}
