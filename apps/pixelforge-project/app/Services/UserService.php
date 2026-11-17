<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class UserService
{

    /** @return Collection<int, User> */
    public function getUsers(): Collection
    {
        return User::query()
            ->orderBy('name')
            ->get();
    }

    public function createUser(string $name, string $email, string $password): User
    {
        return User::query()
            ->create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
            ]);
    }

    public function updateUser(int $id, string $name, string $email): void
    {
        DB::transaction(function () use ($id, $name, $email): void {
            $user = User::query()
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            if ($user->email !== $email) {
                $user->email_verified_at = null;
            }
            $user->update([
                'name' => $name,
                'email' => $email,
            ]);
        });
    }

    public function deleteUser(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $user = User::query()
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $user->delete();
        });
    }

    public function store(string $name, string $email, string $password, bool $isSuperadmin = false): void
    {
        User::query()
            ->insertOrIgnore([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'is_superadmin' => $isSuperadmin,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
    }
}
