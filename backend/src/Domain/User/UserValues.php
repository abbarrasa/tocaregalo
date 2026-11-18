<?php

declare(strict_types=1);

namespace App\Domain\User;

final class UserValues
{
    public static function text(string $value): string
    {
        return preg_replace('/^\s+|\s+$/u', '', $value) ?? throw new \InvalidArgumentException('El texto no es válido.');
    }

    public static function required(string $value): string
    {
        $value = self::text($value);
        if ($value === '') {
            throw new \InvalidArgumentException('Este campo es obligatorio.');
        }

        return $value;
    }

    public static function lastName(?string $value): ?string
    {
        $value = self::text($value ?? '');

        return $value === '' ? null : $value;
    }

    public static function emailComparison(string $email): string
    {
        return mb_strtolower(self::required($email), 'UTF-8');
    }

    public static function phone(string $value): string
    {
        if (!mb_check_encoding($value, 'UTF-8') || preg_match('/\p{L}/u', $value) === 1) {
            throw new \InvalidArgumentException('El teléfono no es válido.');
        }
        $phone = preg_replace('/[^0-9+]/u', '', $value);
        if (!is_string($phone) || preg_match('/^\+[0-9]+$/D', $phone) !== 1) {
            throw new \InvalidArgumentException('El teléfono debe incluir el prefijo de país con +.');
        }

        return $phone;
    }
}
