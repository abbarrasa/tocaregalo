<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

final class DeliveryUnavailable extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('Recovery delivery unavailable.');
    }
}
