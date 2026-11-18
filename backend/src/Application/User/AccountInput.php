<?php

declare(strict_types=1);

namespace App\Application\User;

use App\Application\Port\ProfileValidator;
use App\Domain\User\PasswordPolicy;
use App\Domain\User\UserProfile;
use App\Domain\User\UserValues;

final readonly class AccountInput
{
    public function __construct(private ProfileValidator $validator)
    {
    }

    /** @param array<array-key, mixed> $values */
    public function keys(array $values): void
    {
        if ($values === []) {
            throw new AccountValidation(['_form' => 'Indica al menos un campo.']);
        }
        $errors = [];
        foreach ($values as $key => $value) {
            if (!in_array($key, ['firstName', 'lastName', 'email', 'phone', 'password'], true)) {
                $errors[is_string($key) ? $key : '_form'] = 'Este campo no se puede modificar.';
            }
        }
        if ($errors !== []) {
            throw new AccountValidation($errors);
        }
    }

    /** @param array<array-key, mixed> $values */
    public function profile(array $values, ?UserProfile $current = null): UserProfile
    {
        $normalized = ['firstName' => '', 'email' => '', 'phone' => ''];
        $errors = [];
        foreach (array_keys($normalized) as $field) {
            $fallback = match ($field) {
                'firstName' => $current?->firstName,
                'email' => $current?->email,
                'phone' => $current?->phone,
            };
            $value = array_key_exists($field, $values) ? $values[$field] : $fallback;
            if (!is_string($value)) {
                $errors[$field] = 'Este campo es obligatorio y debe ser texto.';
                continue;
            }
            try {
                $normalized[$field] = match ($field) {
                    'firstName' => UserValues::required($value),
                    'email' => $this->validator->email($value),
                    'phone' => UserValues::phone($value),
                };
            } catch (\InvalidArgumentException $exception) {
                $errors[$field] = $exception->getMessage();
            }
        }
        $lastName = array_key_exists('lastName', $values) ? $values['lastName'] : $current?->lastName;
        if ($lastName !== null && !is_string($lastName)) {
            $errors['lastName'] = 'Los apellidos deben ser texto o null.';
        } else {
            try {
                $lastName = UserValues::lastName($lastName);
            } catch (\InvalidArgumentException $exception) {
                $errors['lastName'] = $exception->getMessage();
            }
        }
        if ($errors !== []) {
            throw new AccountValidation($errors);
        }
        return new UserProfile($normalized['firstName'], is_string($lastName) ? $lastName : null, $normalized['email'], $normalized['phone']);
    }

    /** @param array<array-key, mixed> $values */
    public function password(#[\SensitiveParameter] array $values, bool $required): ?string
    {
        if (!array_key_exists('password', $values) && !$required) {
            return null;
        }
        $password = $values['password'] ?? null;
        if (!is_string($password)) {
            throw new AccountValidation(['password' => 'La contraseña es obligatoria y debe ser texto.']);
        }
        try {
            return PasswordPolicy::validate($password);
        } catch (\InvalidArgumentException $exception) {
            throw new AccountValidation(['password' => $exception->getMessage()]);
        }
    }
}
