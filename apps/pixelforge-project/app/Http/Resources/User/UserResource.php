<?php

namespace App\Http\Resources\User;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $resource = $this->resource;

        $id = $resource->id;
        $name = $resource->name;
        $email = $resource->email;
        $emailVerifiedAt = $resource->email_verified_at;
        $createdAt = $resource->created_at;
        $updatedAt = $resource->updated_at;

        return [
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'emailVerifiedAt' => $emailVerifiedAt,
            'createdAt' => $createdAt,
            'updatedAt' => $updatedAt,
        ];
    }
}
