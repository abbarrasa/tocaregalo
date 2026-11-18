<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine\Record;

class RoleRecord
{
    public ?int $id = null;

    public function __construct(public string $name)
    {
    }
}
