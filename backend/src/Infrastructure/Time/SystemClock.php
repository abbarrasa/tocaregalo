<?php

declare(strict_types=1);

namespace App\Infrastructure\Time;

final readonly class SystemClock implements \App\Application\Port\Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }
}
