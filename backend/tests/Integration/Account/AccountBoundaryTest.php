<?php

declare(strict_types=1);

namespace App\Tests\Integration\Account;

use App\Domain\User\Role;
use App\Domain\User\User;
use App\Infrastructure\Doctrine\DoctrineUserRepository;
use App\Infrastructure\Doctrine\Record\UserRecord;
use App\Infrastructure\Security\SymfonyPasswordService;
use App\Infrastructure\Validation\UserInputValidator;
use App\Tests\Support\TestDatabase;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaValidator;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Validator\Validation;

final class AccountBoundaryTest extends KernelTestCase
{
    private TestDatabase $database;
    private Connection $connection;
    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        // Guard the declared test URL before any migration/DDL, independently of the ORM.
        $this->database = TestDatabase::fromEnvironment();
        $this->connection = $this->database->connection();
        self::bootKernel(['environment' => 'test', 'debug' => false]);
        $entityManager = self::getContainer()->get(EntityManagerInterface::class);
        self::assertInstanceOf(EntityManagerInterface::class, $entityManager);
        $this->entityManager = $entityManager;
        $ormConnection = $this->entityManager->getConnection();
        foreach (['driver', 'host', 'port', 'dbname', 'user', 'password'] as $key) {
            // Do not let failed target comparisons print credential values.
            self::assertTrue(($this->connection->getParams()[$key] ?? null) === ($ormConnection->getParams()[$key] ?? null), 'ORM must use the guarded test connection.');
        }
        $this->migrate('latest');
    }

    protected function tearDown(): void
    {
        if (isset($this->connection)) {
            try {
                $this->migrate('0');
            } finally {
                $this->database->close();
                parent::tearDown();
            }
        }
    }

    private static function integer(mixed $value): int
    {
        if (!is_int($value) && !is_string($value)) {
            throw new \LogicException('Expected integer database result.');
        }

        return (int) $value;
    }

    private function migrate(string $version): void
    {
        // Each CLI invocation has a fresh migration factory; executed migration
        // instances are frozen and cannot be reused for another direction.
        $kernel = new \App\Kernel('test', false);
        $application = new Application($kernel);
        $application->setAutoExit(false);
        $application->setCatchExceptions(false);
        $input = new ArrayInput(['command' => 'doctrine:migrations:migrate', 'version' => $version, '--no-interaction' => true]);
        $input->setInteractive(false);
        try {
            self::assertSame(0, $application->run($input, new BufferedOutput()));
        } finally {
            $kernel->shutdown();
        }
    }

    private function creator(): \App\Application\User\CreateOrdinaryUser
    {
        return new \App\Application\User\CreateOrdinaryUser(
            new \App\Infrastructure\Doctrine\DoctrineAccountStore($this->entityManager->getConnection()),
            new \App\Application\User\AccountInput(new UserInputValidator(Validation::createValidator())),
            new \App\Application\User\AccountUniqueness(new DoctrineUserRepository($this->entityManager)),
            new SymfonyPasswordService(),
        );
    }

    private function editor(): \App\Application\User\UpdateOwnAccount
    {
        return new \App\Application\User\UpdateOwnAccount(
            new \App\Infrastructure\Doctrine\DoctrineAccountStore($this->entityManager->getConnection()),
            new \App\Application\User\AccountInput(new UserInputValidator(Validation::createValidator())),
            new \App\Application\User\AccountUniqueness(new DoctrineUserRepository($this->entityManager)),
            new SymfonyPasswordService(),
        );
    }

    /** @return array<string, mixed> */
    private function values(string $email = 'new@example.test', string $phone = '+34600123456'): array
    {
        return ['firstName' => ' Ana ', 'lastName' => null, 'email' => $email, 'phone' => $phone, 'password' => ' initial password '];
    }

    private function fieldFailure(callable $action, string $field): void
    {
        try {
            $action();
            self::fail('Invalid account input must fail.');
        } catch (\App\Application\User\AccountValidation $exception) {
            self::assertArrayHasKey($field, $exception->fields);
        }
    }

    public function testOrdinaryCreationHasFixedRoleAndDuplicateInputCannotPromote(): void
    {
        (new DoctrineUserRepository($this->entityManager))->saveRole(new Role(Role::SUPER_ADMIN));
        $creator = $this->creator();
        $user = $creator->create($this->values());
        self::assertSame('Ana', $user->profile->firstName);
        self::assertSame([Role::USER], array_map(static fn (Role $role): string => $role->name, $user->roles));
        self::assertTrue((new SymfonyPasswordService())->verify($user->passwordHash, ' initial password '));
        $snapshot = $this->connection->fetchAllAssociative('SELECT * FROM users');
        $this->fieldFailure(fn () => $creator->create($this->values('NEW@example.test', '+12025550101')), 'email');
        $this->fieldFailure(fn () => $creator->create($this->values('other@example.test', '+34 600-123-456')), 'phone');
        $this->fieldFailure(fn () => $creator->create($this->values('other@example.test', '+12025550101') + ['roles' => [Role::SUPER_ADMIN]]), 'roles');
        self::assertTrue($snapshot === $this->connection->fetchAllAssociative('SELECT * FROM users'), 'Existing accounts must not change.');
        self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM user_roles')));
    }

    public function testInvalidPasswordsAndStorageFailureLeaveNoPartialRoleOrAccount(): void
    {
        $creator = $this->creator();
        foreach (['abcde', null, str_repeat('á', 2048).'a'] as $password) {
            $values = $this->values(); $values['password'] = $password;
            $this->fieldFailure(fn () => $creator->create($values), 'password');
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        }
        $values = $this->values(); $values['firstName'] = str_repeat('a', 256);
        try {
            $creator->create($values);
            self::fail('The installed MySQL column limit must reject this fixture.');
        } catch (\Doctrine\DBAL\Exception) {
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        }
        $values = $this->values(); $values['password'] = str_repeat('á', 2048);
        $user = $creator->create($values);
        self::assertTrue((new SymfonyPasswordService())->verify($user->passwordHash, str_repeat('á', 2048)));
    }

    public function testDifferentTargetIsDeniedBeforeAnyWrite(): void
    {
        try {
            $this->editor()->update(1, 2, ['firstName' => 'Changed']);
            self::fail('Own-account policy must reject another target.');
        } catch (\App\Application\User\AccountAccessDenied) {
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
        }
    }

    /** @return iterable<string, array{string, string}> */
    public static function races(): iterable
    {
        foreach (['create', 'update'] as $operation) {
            foreach (['email', 'phone'] as $field) {
                yield $operation.' '.$field => [$operation, $field];
            }
        }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('races')]
    public function testDatabaseRaceAfterApplicationPrecheckIsAFieldError(string $operation, string $field): void
    {
        $creator = $this->creator();
        $loser = $operation === 'update' ? $creator->create($this->values('loser@example.test', '+12025550999')) : null;
        if ($loser === null) {
            (new DoctrineUserRepository($this->entityManager))->saveRole(new Role(Role::USER));
        }
        $directory = sys_get_temp_dir().'/tocaregalo-race-'.bin2hex(random_bytes(8));
        self::assertTrue(mkdir($directory, 0700));
        $output = tmpfile(); self::assertIsResource($output);
        $pipes = [];
        $process = proc_open([PHP_BINARY, 'tests/Fixtures/Account/race.php', $directory, $operation, $field, (string) ($loser->id ?? 0)], [0 => ['file', '/dev/null', 'r'], 1 => $output, 2 => $output], $pipes, dirname(__DIR__, 3));
        self::assertIsResource($process);
        try {
            $deadline = microtime(true) + 30;
            while (!is_file($directory.'/ready') && microtime(true) < $deadline) {
                usleep(20000);
            }
            self::assertFileExists($directory.'/ready', 'Child must pass actual application prechecks before the competing write.');
            $snapshot = $loser === null ? null : $this->connection->fetchAssociative('SELECT * FROM users WHERE id = ?', [$loser->id]);
            $email = $field === 'email' ? 'race@example.test' : 'winner@example.test';
            $phone = $field === 'phone' ? '+12025550101' : '+12025550102';
            $this->connection->insert('users', ['first_name' => 'Winner', 'last_name' => null, 'email' => $email, 'email_comparison' => $email, 'phone' => $phone, 'password_hash' => 'synthetic-not-for-login']);
            $winnerId = self::integer($this->connection->lastInsertId());
            $roleId = self::integer($this->connection->fetchOne('SELECT id FROM roles WHERE name = ?', [Role::USER]));
            $this->connection->insert('user_roles', ['user_id' => $winnerId, 'role_id' => $roleId]);
            file_put_contents($directory.'/go', '1');
            do {
                $status = proc_get_status($process);
                if (!$status['running']) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            self::assertFalse($status['running'], 'Race child must finish.');
            self::assertSame(0, $status['exitcode']);
            rewind($output);
            $result = stream_get_contents($output); self::assertIsString($result);
            self::assertSame([$field], json_decode($result, true, flags: JSON_THROW_ON_ERROR));
            self::assertSame($loser === null ? 1 : 2, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
            if ($loser !== null) {
                self::assertTrue($snapshot === $this->connection->fetchAssociative('SELECT * FROM users WHERE id = ?', [$loser->id]), 'Losing account must be unchanged.');
            }
        } finally {
            $status = proc_get_status($process);
            if ($status['running']) {
                proc_terminate($process, 9);
            }
            proc_close($process); fclose($output);
            foreach (['ready', 'go'] as $file) {
                if (is_file($directory.'/'.$file)) {
                    unlink($directory.'/'.$file);
                }
            }
            rmdir($directory);
        }
    }
}
