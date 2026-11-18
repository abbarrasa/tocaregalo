<?php

declare(strict_types=1);

namespace App\Domain\User;

final readonly class User
{
    /** @param list<Role> $roles */
    public function __construct(
        public UserProfile $profile,
        public string $passwordHash,
        public array $roles = [],
        public ?int $id = null,
    ) {
    }
}
