<?php

declare(strict_types=1);

namespace App\Application\User;

final class AccountValidation extends \InvalidArgumentException
{
    /** @param array<string, string> $fields */
    public function __construct(public readonly array $fields)
    {
        parent::__construct('Los datos de la cuenta no son válidos.');
    }
}
