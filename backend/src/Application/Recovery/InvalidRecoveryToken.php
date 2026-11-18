<?php

declare(strict_types=1);

namespace App\Application\Recovery;

final class InvalidRecoveryToken extends \DomainException
{
    public function __construct()
    {
        parent::__construct('El enlace de recuperación no es válido o ha caducado.');
    }
}
