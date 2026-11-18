<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

final readonly class RecoveryMail
{
    public function __construct(public int $deliveryId)
    {
    }
}
