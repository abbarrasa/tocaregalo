<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine;

use App\Application\Port\SuperAdminStore;
use App\Domain\User\Role;
use App\Domain\User\UserProfile;
use App\Infrastructure\Doctrine\Record\RoleRecord;
use App\Infrastructure\Doctrine\Record\UserRecord;
use Doctrine\DBAL\Exception as DatabaseException;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;

final readonly class DoctrineSuperAdminStore implements SuperAdminStore
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    public function create(UserProfile $profile, string $passwordHash): void
    {
        try {
            $users = $this->entityManager->getRepository(UserRecord::class);
            if ($users->findOneBy(['emailComparison' => $profile->emailComparison]) !== null || $users->findOneBy(['phone' => $profile->phone]) !== null) {
                throw new \DomainException('Ya existe un usuario con ese correo electrónico o teléfono. No se ha modificado su cuenta.');
            }
            $this->entityManager->wrapInTransaction(function (EntityManagerInterface $manager) use ($profile, $passwordHash): void {
                $role = $manager->getRepository(RoleRecord::class)->findOneBy(['name' => Role::SUPER_ADMIN]);
                if ($role === null) {
                    $role = new RoleRecord(Role::SUPER_ADMIN);
                    $manager->persist($role);
                }
                $user = new UserRecord();
                $user->firstName = $profile->firstName;
                $user->lastName = $profile->lastName;
                $user->email = $profile->email;
                $user->emailComparison = $profile->emailComparison;
                $user->phone = $profile->phone;
                $user->passwordHash = $passwordHash;
                $user->roles->add($role);
                $manager->persist($user);
            });
        } catch (UniqueConstraintViolationException) {
            throw new \DomainException('El correo, teléfono o rol se ha creado simultáneamente. No se ha creado la cuenta; vuelve a intentarlo.');
        } catch (DatabaseException) {
            throw new \RuntimeException('No se ha podido crear la cuenta. Comprueba la conexión y las migraciones.');
        }
    }
}
