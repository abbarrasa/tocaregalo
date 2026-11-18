<?php

declare(strict_types=1);

namespace App\Domain\User;

final readonly class Role
{
    public const string USER = 'ROLE_USER';
    public const string SUPER_ADMIN = 'ROLE_SUPER_ADMIN';

    public function __construct(public string $name, public ?int $id = null)
    {
    }
}
