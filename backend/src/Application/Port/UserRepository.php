<?php

declare(strict_types=1);

namespace App\Application\Port;

use App\Domain\User\Role;
use App\Domain\User\User;

interface UserRepository
{
    public function save(User $user): User;

    public function saveRole(Role $role): Role;

    public function findById(int $id): ?User;

    public function findByEmailComparison(string $email): ?User;

    public function findByPhone(string $phone): ?User;
}
