<?php

declare(strict_types=1);

namespace App\Application\User;

use App\Application\Port\AccountStore;
use App\Application\Port\PasswordService;
use App\Domain\User\User;

final readonly class CreateOrdinaryUser
{
    public function __construct(private AccountStore $store, private AccountInput $input, private AccountUniqueness $uniqueness, private PasswordService $passwords)
    {
    }

    /** @param array<array-key, mixed> $values */
    public function create(#[\SensitiveParameter] array $values): User
    {
        $this->input->keys($values);
        $profile = $this->input->profile($values);
        $password = $this->input->password($values, true) ?? throw new \LogicException('Password is required.');
        $this->uniqueness->check($profile);
        return $this->store->create($profile, $this->passwords->hash($password));
    }
}
