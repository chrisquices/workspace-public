<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_superadmin;
    }

    public function create(User $user): bool
    {
        return $user->is_superadmin;
    }

    public function update(User $user): bool
    {
        return $user->is_superadmin;
    }

    public function delete(User $user): bool
    {
        return $user->is_superadmin;
    }
}
