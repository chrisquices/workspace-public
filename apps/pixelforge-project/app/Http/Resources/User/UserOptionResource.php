<?php

namespace App\Http\Resources\User;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserOptionResource extends JsonResource
{

    /** @return array{id: int, name: string} */
    public function toArray(Request $request): array
    {
        $resource = $this->resource;

        $id = $resource->id;
        $name = $resource->name;

        return [
            'id' => $id,
            'name' => $name,
        ];
    }
}
