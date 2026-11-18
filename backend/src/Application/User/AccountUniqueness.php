<?php

declare(strict_types=1);

namespace App\Application\User;

use App\Application\Port\UserRepository;
use App\Domain\User\UserProfile;

final readonly class AccountUniqueness
{
    public function __construct(private UserRepository $users)
    {
    }

    public function check(UserProfile $profile, ?int $except = null): void
    {
        $errors = [];
        $email = $this->users->findByEmailComparison($profile->emailComparison);
        if ($email !== null && $email->id !== $except) {
            $errors['email'] = 'Ya existe una cuenta con ese correo electrónico.';
        }
        $phone = $this->users->findByPhone($profile->phone);
        if ($phone !== null && $phone->id !== $except) {
            $errors['phone'] = 'Ya existe una cuenta con ese teléfono.';
        }
        if ($errors !== []) {
            throw new AccountValidation($errors);
        }
    }
}
