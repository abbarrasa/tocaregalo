<?php

declare(strict_types=1);

namespace App\Application\User;

use App\Application\Port\PasswordService;
use App\Application\Port\SuperAdminStore;
use App\Domain\User\UserProfile;

final readonly class CreateSuperAdmin
{
    public function __construct(private PasswordService $passwords, private SuperAdminStore $store)
    {
    }

    public function create(UserProfile $profile, #[\SensitiveParameter] string $password): void
    {
        $this->store->create($profile, $this->passwords->hash($password));
    }
}
