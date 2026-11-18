<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine;

use App\Application\Port\UserRepository;
use App\Domain\User\Role;
use App\Domain\User\User;
use App\Domain\User\UserProfile;
use App\Infrastructure\Doctrine\Record\RoleRecord;
use App\Infrastructure\Doctrine\Record\UserRecord;
use Doctrine\ORM\EntityManagerInterface;

final readonly class DoctrineUserRepository implements UserRepository
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    public function saveRole(Role $role): Role
    {
        $record = new RoleRecord($role->name);
        $this->entityManager->persist($record);
        $this->entityManager->flush();

        return new Role($record->name, $record->id);
    }

    public function save(User $user): User
    {
        $record = $user->id === null ? new UserRecord() : $this->entityManager->find(UserRecord::class, $user->id);
        if ($record === null) {
            throw new \LogicException('User not found.');
        }
        $record->firstName = $user->profile->firstName;
        $record->lastName = $user->profile->lastName;
        $record->email = $user->profile->email;
        $record->emailComparison = $user->profile->emailComparison;
        $record->phone = $user->profile->phone;
        $record->passwordHash = $user->passwordHash;
        $record->roles->clear();
        foreach ($user->roles as $role) {
            $roleRecord = $this->entityManager->getRepository(RoleRecord::class)->findOneBy(['name' => $role->name]);
            if ($roleRecord === null) {
                throw new \LogicException('Role must exist before assigning it.');
            }
            $record->roles->add($roleRecord);
        }
        $this->entityManager->persist($record);
        $this->entityManager->flush();

        return $this->toDomain($record);
    }

    public function findById(int $id): ?User
    {
        $record = $this->entityManager->find(UserRecord::class, $id);

        return $record === null ? null : $this->toDomain($record);
    }

    public function findByEmailComparison(string $email): ?User
    {
        $record = $this->entityManager->getRepository(UserRecord::class)->findOneBy(['emailComparison' => $email]);

        return $record === null ? null : $this->toDomain($record);
    }

    public function findByPhone(string $phone): ?User
    {
        $record = $this->entityManager->getRepository(UserRecord::class)->findOneBy(['phone' => $phone]);

        return $record === null ? null : $this->toDomain($record);
    }

    private function toDomain(UserRecord $record): User
    {
        $profile = new UserProfile($record->firstName, $record->lastName, $record->email, $record->phone);
        $roles = [];
        foreach ($record->roles as $role) {
            $roles[] = new Role($role->name, $role->id);
        }

        return new User($profile, $record->passwordHash, $roles, $record->id);
    }
}
