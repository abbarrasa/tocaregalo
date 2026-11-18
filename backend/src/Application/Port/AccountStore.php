<?php

declare(strict_types=1);

namespace App\Application\Port;

use App\Domain\User\User;
use App\Domain\User\UserProfile;

interface AccountStore
{
    public function create(UserProfile $profile, string $passwordHash): User;

    /** @param callable(User): User $change */
    public function update(int $id, callable $change): User;
}
