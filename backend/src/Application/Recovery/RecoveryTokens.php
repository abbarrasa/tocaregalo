<?php

declare(strict_types=1);

namespace App\Application\Recovery;

use App\Application\Port\Clock;
use App\Application\Port\PasswordService;
use App\Application\Port\RecoveryStore;
use App\Domain\User\PasswordPolicy;

final readonly class RecoveryTokens
{
    public function __construct(private RecoveryStore $store, private PasswordService $passwords, private Clock $clock, private RecoveryLifetime $lifetime)
    {
    }

    /** @param (callable(int, IssuedRecovery): void)|null $handoff */
    public function issue(int $userId, ?callable $handoff = null): IssuedRecovery
    {
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $result = new class {
            public ?IssuedRecovery $issued = null;
        };
        $this->store->issue($userId, function () use ($token, $result): array {
            $now = $this->clock->now();
            $issued = $result->issued = new IssuedRecovery($token, $this->lifetime->expires($now));
            return ['hash' => hash('sha256', $token), 'issued' => $now, 'expires' => $issued->expiresAt];
        }, function (int $requestId) use ($handoff, $result): void {
            if ($handoff !== null) {
                $handoff($requestId, $result->issued ?? throw new \LogicException('Missing issuance.'));
            }
        });
        return $result->issued ?? throw new \LogicException('Issuance did not complete.');
    }

    public function reset(#[\SensitiveParameter] string $token, #[\SensitiveParameter] string $password): void
    {
        if (preg_match('/\A[A-Za-z0-9_-]{43}\z/D', $token) !== 1) {
            throw new InvalidRecoveryToken();
        }
        $this->store->consume(hash('sha256', $token), function (\DateTimeImmutable $expires, ?\DateTimeImmutable $consumed, ?\DateTimeImmutable $superseded) use ($password): array {
            $now = $this->clock->now();
            if ($consumed !== null || $superseded !== null || $now >= $expires) {
                throw new InvalidRecoveryToken();
            }
            return ["hash" => $this->passwords->hash(PasswordPolicy::validate($password)), "at" => $now];
        });
    }
}
