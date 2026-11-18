<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine;

use App\Application\Port\AccountStore;
use App\Application\User\AccountAccessDenied;
use App\Application\User\AccountValidation;
use App\Domain\User\Role;
use App\Domain\User\User;
use App\Domain\User\UserProfile;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;

final readonly class DoctrineAccountStore implements AccountStore
{
    public function __construct(private Connection $connection)
    {
    }

    public function create(UserProfile $profile, string $passwordHash): User
    {
        try {
            return $this->connection->transactional(function (Connection $db) use ($profile, $passwordHash): User {
                // The unique name makes fixed-role provisioning idempotent under competing writes.
                $db->executeStatement('INSERT INTO roles (name) VALUES (?) ON DUPLICATE KEY UPDATE id = id', [Role::USER]);
                $roleId = self::integer($db->fetchOne('SELECT id FROM roles WHERE name = ?', [Role::USER]));
                $db->insert('users', self::columns($profile, $passwordHash));
                $id = self::integer($db->lastInsertId());
                $db->insert('user_roles', ['user_id' => $id, 'role_id' => $roleId]);
                return new User($profile, $passwordHash, [new Role(Role::USER, $roleId)], $id);
            });
        } catch (UniqueConstraintViolationException $exception) {
            throw self::duplicate($exception);
        }
    }

    public function update(int $id, callable $change): User
    {
        try {
            return $this->connection->transactional(function (Connection $db) use ($id, $change): User {
                $row = $db->fetchAssociative('SELECT * FROM users WHERE id = ? FOR UPDATE', [$id]);
                if ($row === false) {
                    throw new AccountAccessDenied();
                }
                $roles = [];
                foreach ($db->fetchAllAssociative('SELECT r.id, r.name FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?', [$id]) as $role) {
                    $roles[] = new Role(self::text($role['name']), self::integer($role['id']));
                }
                $profile = new UserProfile(self::text($row['first_name']), $row['last_name'] === null ? null : self::text($row['last_name']), self::text($row['email']), self::text($row['phone']));
                $updated = $change(new User($profile, self::text($row['password_hash']), $roles, $id));
                $db->update('users', self::columns($updated->profile, $updated->passwordHash), ['id' => $id]);
                // Roles and identity are persisted authority, never writable callback input.
                return new User($updated->profile, $updated->passwordHash, $roles, $id);
            });
        } catch (UniqueConstraintViolationException $exception) {
            throw self::duplicate($exception);
        }
    }

    /** @return array<string, string|null> */
    private static function columns(UserProfile $profile, string $hash): array
    {
        return ['first_name' => $profile->firstName, 'last_name' => $profile->lastName, 'email' => $profile->email, 'email_comparison' => $profile->emailComparison, 'phone' => $profile->phone, 'password_hash' => $hash];
    }

    private static function duplicate(UniqueConstraintViolationException $exception): AccountValidation
    {
        if (str_contains($exception->getMessage(), 'UNIQ_1483A5E949F93409')) {
            return new AccountValidation(['email' => 'Ya existe una cuenta con ese correo electrónico.']);
        }
        if (str_contains($exception->getMessage(), 'UNIQ_1483A5E9444F97DD')) {
            return new AccountValidation(['phone' => 'Ya existe una cuenta con ese teléfono.']);
        }
        throw new \RuntimeException('Could not persist account.');
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? $value : throw new \LogicException('Expected text from persistence.');
    }

    private static function integer(mixed $value): int
    {
        return is_int($value) || is_string($value) ? (int) $value : throw new \LogicException('Expected persisted ID.');
    }
}
