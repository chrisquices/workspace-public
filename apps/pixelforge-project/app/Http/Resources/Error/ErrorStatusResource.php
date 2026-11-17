<?php

namespace App\Http\Resources\Error;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ErrorStatusResource extends JsonResource
{

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $resource = $this->resource;

        $status = $resource;

        return [
            'status' => $status,
        ];
    }
}
