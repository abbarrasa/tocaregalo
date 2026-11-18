<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine\Record;

class PasswordResetRecord
{
    public ?int $id = null;
    public UserRecord $user;
    public string $tokenHash;
    public \DateTimeImmutable $issuedAt;
    public \DateTimeImmutable $expiresAt;
    public ?\DateTimeImmutable $consumedAt = null;
    public ?\DateTimeImmutable $supersededAt = null;
}
