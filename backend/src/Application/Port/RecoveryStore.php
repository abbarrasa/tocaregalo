<?php

declare(strict_types=1);

namespace App\Application\Port;

interface RecoveryStore
{
    /** @param callable(): array{hash: string, issued: \DateTimeImmutable, expires: \DateTimeImmutable} $issue
     * @param (callable(int): void)|null $handoff
     */
    public function issue(int $userId, callable $issue, ?callable $handoff = null): void;

    /** @param callable(\DateTimeImmutable, ?\DateTimeImmutable, ?\DateTimeImmutable): array{hash: string, at: \DateTimeImmutable} $consume */
    public function consume(string $digest, callable $consume): void;
}
