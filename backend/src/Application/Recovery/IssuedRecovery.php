<?php

declare(strict_types=1);

namespace App\Application\Recovery;

final readonly class IssuedRecovery implements \JsonSerializable
{
    public function __construct(#[\SensitiveParameter] public string $token, public \DateTimeImmutable $expiresAt)
    {
    }

    /** @return array{expiresAt: \DateTimeImmutable} */
    public function __debugInfo(): array
    {
        return ['expiresAt' => $this->expiresAt];
    }

    public function jsonSerialize(): never
    {
        throw new \LogicException("Recovery bearer material must not be serialized.");
    }

    public function __serialize(): never
    {
        throw new \LogicException('Recovery bearer material must not be serialized.');
    }
}
