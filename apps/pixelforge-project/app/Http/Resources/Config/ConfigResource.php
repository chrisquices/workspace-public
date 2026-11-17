<?php

namespace App\Http\Resources\Config;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConfigResource extends JsonResource
{

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $resource = $this->resource;

        $supportedFileFormats = $resource['supported_file_formats'];
        $extensions = array_merge(...array_values($supportedFileFormats));
        $maxSize = $resource['uploads']['max_size'];
        $maxFiles = $resource['uploads']['max_files'];
        $upload = [
            'extensions' => $extensions,
            'maxSize' => $maxSize,
            'maxFiles' => $maxFiles,
        ];

        return [
            'upload' => $upload,
            'supportedFileFormats' => $supportedFileFormats,
        ];
    }
}
