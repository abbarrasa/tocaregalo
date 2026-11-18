<?php

declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Application\Port\PasswordService;
use App\Domain\User\PasswordPolicy;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactory;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

final readonly class SymfonyPasswordService implements PasswordService
{
    private PasswordHasherInterface $hasher;

    public function __construct()
    {
        $this->hasher = (new PasswordHasherFactory(['identity' => ['algorithm' => 'auto']]))->getPasswordHasher('identity');
    }

    public function hash(#[\SensitiveParameter] string $password): string
    {
        return $this->hasher->hash(PasswordPolicy::validate($password));
    }

    public function verify(string $hash, #[\SensitiveParameter] string $password): bool
    {
        return $this->hasher->verify($hash, $password);
    }
}
