<?php

declare(strict_types=1);

namespace App\Domain\User;

final class PasswordPolicy
{
    public static function validate(#[\SensitiveParameter] string $password): string
    {
        if (!mb_check_encoding($password, 'UTF-8') || mb_strlen($password, 'UTF-8') < 6) {
            throw new \InvalidArgumentException('La contraseña debe tener al menos 6 caracteres.');
        }

        if (strlen($password) > 4096) {
            throw new \InvalidArgumentException('La contraseña no puede superar los 4096 bytes UTF-8.');
        }

        return $password;
    }
}
