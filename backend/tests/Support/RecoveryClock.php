<?php

declare(strict_types=1);

namespace App\Tests\Support;

final class RecoveryClock implements \App\Application\Port\Clock
{
    public function __construct(public \DateTimeImmutable $instant)
    {
    }

    public function now(): \DateTimeImmutable
    {
        return $this->instant;
    }
}
