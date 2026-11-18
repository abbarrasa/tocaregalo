<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine\Record;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

class UserRecord
{
    public ?int $id = null;
    public string $firstName;
    public ?string $lastName = null;
    public string $email;
    public string $emailComparison;
    public string $phone;
    public string $passwordHash;
    /** @var Collection<int, RoleRecord> */
    public Collection $roles;

    public function __construct()
    {
        $this->roles = new ArrayCollection();
    }
}
