<?php

declare(strict_types=1);

namespace App\Application\User;

use App\Application\Port\AccountStore;
use App\Application\Port\PasswordService;
use App\Domain\User\User;

final readonly class UpdateOwnAccount
{
    public function __construct(private AccountStore $store, private AccountInput $input, private AccountUniqueness $uniqueness, private PasswordService $passwords)
    {
    }

    /** @param array<array-key, mixed> $changes */
    public function update(int $actorId, int $targetId, #[\SensitiveParameter] array $changes): User
    {
        if ($actorId !== $targetId) {
            throw new AccountAccessDenied();
        }
        $this->input->keys($changes);
        return $this->store->update($targetId, function (User $current) use ($changes): User {
            $profile = $this->input->profile($changes, $current->profile);
            $password = $this->input->password($changes, false);
            $this->uniqueness->check($profile, $current->id);
            $hash = $password === null ? $current->passwordHash : $this->passwords->hash($password);
            return new User($profile, $hash, $current->roles, $current->id);
        });
    }
}
