<?php

declare(strict_types=1);

namespace App\Application\Port;

use App\Domain\User\UserProfile;

interface SuperAdminStore
{
    public function create(UserProfile $profile, string $passwordHash): void;
}
