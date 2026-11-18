<?php

declare(strict_types=1);

namespace App\Application\Recovery;

use App\Application\Port\ProfileValidator;
use App\Application\Port\RecoveryDelivery;
use App\Application\Port\UserRepository;
use App\Domain\User\UserValues;

final readonly class RequestRecovery
{
    public function __construct(private UserRepository $users, private ProfileValidator $validator, private RecoveryTokens $tokens, private RecoveryDelivery $delivery)
    {
    }

    public function request(string $identifier): void
    {
        $identifier = trim($identifier);
        $phone = str_starts_with($identifier, '+');
        $normalized = $phone ? UserValues::phone($identifier) : UserValues::emailComparison($this->validator->email($identifier));
        $this->delivery->validate();
        $user = $phone ? $this->users->findByPhone($normalized) : $this->users->findByEmailComparison($normalized);
        if ($user?->id !== null) {
            $id = $user->id;
            $this->tokens->issue($id, fn (int $requestId, IssuedRecovery $issued) => $this->delivery->enqueue($id, $requestId, $issued));
        }
    }
}
