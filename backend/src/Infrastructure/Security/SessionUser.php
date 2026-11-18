<?php

declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Domain\User\User;
use Symfony\Component\Security\Core\User\UserInterface;

final class SessionUser implements UserInterface
{
    private int $id;
    private ?User $user = null;

    public function __construct(User $user)
    {
        $this->id = $user->id ?? throw new \LogicException('A persisted user is required.');
        $this->user = $user;
    }

    public function domainUser(): User
    {
        return $this->user ?? throw new \LogicException('Session identity must be refreshed before use.');
    }

    public function getUserIdentifier(): string
    {
        return (string) $this->id;
    }

    public function getRoles(): array
    {
        return array_map(static fn ($role): string => $role->name, $this->domainUser()->roles);
    }

    public function eraseCredentials(): void
    {
    }

    /** @return array{id: int} */
    public function __serialize(): array
    {
        return ['id' => $this->id];
    }

    /** @param array<array-key, mixed> $data */
    public function __unserialize(array $data): void
    {
        if (!isset($data['id']) || !is_int($data['id']) || $data['id'] < 1) {
            throw new \UnexpectedValueException('Invalid session identity.');
        }
        $this->id = $data['id'];
        $this->user = null;
    }
}
