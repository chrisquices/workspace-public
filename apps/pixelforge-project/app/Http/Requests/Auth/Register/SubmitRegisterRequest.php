<?php

namespace App\Http\Requests\Auth\Register;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class SubmitRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge([
                'email' => Str::lower($this->input('email')),
            ]);
        }
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $name = ['required', 'string', 'max:255'];
        $email = ['required', 'string', 'email', 'max:255', 'unique:users,email'];
        $password = ['required', 'string', 'confirmed', Password::defaults()];

        return [
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ];
    }
}
