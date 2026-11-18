<?php

declare(strict_types=1);

namespace App\Application\Port;

interface PasswordService
{
    public function hash(#[\SensitiveParameter] string $password): string;

    public function verify(string $hash, #[\SensitiveParameter] string $password): bool;
}
