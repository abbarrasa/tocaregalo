<?php

declare(strict_types=1);

namespace App\Application\Port;

interface ProfileValidator
{
    public function email(string $email): string;
}
