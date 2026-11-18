<?php

declare(strict_types=1);

namespace App\Application\Recovery;

final readonly class RecoveryLifetime
{
    private int $seconds;

    public function __construct(int|string $seconds = 3600)
    {
        $parsed = filter_var($seconds, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!is_int($parsed)) {
            throw new \InvalidArgumentException('PASSWORD_RESET_TTL_SECONDS must be a positive integer.');
        }
        $this->seconds = $parsed;
    }

    public function expires(\DateTimeImmutable $now): \DateTimeImmutable
    {
        return $now->modify('+'.$this->seconds.' seconds');
    }
}
