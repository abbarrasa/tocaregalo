<?php

declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Application\Port\UserRepository;
use App\Domain\User\UserValues;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

/** @implements UserProviderInterface<SessionUser> */
final readonly class SessionUserProvider implements UserProviderInterface
{
    public function __construct(private UserRepository $users)
    {
    }

    public function loadUserByIdentifier(string $identifier): SessionUser
    {
        try {
            $user = str_contains($identifier, '@')
                ? $this->users->findByEmailComparison(UserValues::emailComparison($identifier))
                : $this->users->findByPhone(UserValues::phone($identifier));
        } catch (\InvalidArgumentException) {
            throw new UserNotFoundException();
        }
        return new SessionUser($user ?? throw new UserNotFoundException());
    }

    public function refreshUser(UserInterface $user): SessionUser
    {
        if (!$user instanceof SessionUser) {
            throw new UnsupportedUserException();
        }
        $fresh = $this->users->findById((int) $user->getUserIdentifier());
        return new SessionUser($fresh ?? throw new UserNotFoundException());
    }

    public function supportsClass(string $class): bool
    {
        return $class === SessionUser::class;
    }
}
