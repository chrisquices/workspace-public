<?php

namespace App\Exceptions;

use Illuminate\Http\Client\Response;
use RuntimeException;

class PixelforgeApiException extends RuntimeException
{

    /** @param array<array-key, mixed> $validationErrors */
    public function __construct(public readonly string $errorCode, public readonly ?int $status = null, public readonly bool $retryable = false, public readonly ?int $retryAfter = null, public readonly ?string $parameter = null, public readonly array $validationErrors = [], public readonly ?string $errorType = null, public readonly ?string $providerMessage = null, public readonly bool $mayHaveBeenAccepted = false)
    {
        parent::__construct('Pixelforge request failed'.($status === null ? '.' : " (HTTP {$status})."));
    }

    public static function fromResponse(Response $response, bool $mayHaveBeenAccepted = false): self
    {
        $code = $response->json('error.code');
        $parameter = $response->json('error.param');
        $errors = $response->json('error.errors');
        $type = $response->json('error.type');
        $message = $response->json('error.message');
        $retryAfter = trim($response->header('Retry-After'));

        return new self(errorCode: is_string($code) ? $code : 'http_error', status: $response->status(), retryable: $code !== 'daily_limit_exceeded' && ($response->serverError() || $response->status() === 429), retryAfter: ctype_digit($retryAfter) ? (int) $retryAfter : null, parameter: is_string($parameter) ? $parameter : null, validationErrors: is_array($errors) ? $errors : [], errorType: is_string($type) ? $type : null, providerMessage: is_string($message) ? $message : null, mayHaveBeenAccepted: $mayHaveBeenAccepted);
    }
}
