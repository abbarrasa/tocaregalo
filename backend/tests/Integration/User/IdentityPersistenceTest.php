<?php

declare(strict_types=1);

namespace App\Tests\Integration\User;

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

final class IdentityPersistenceTest extends KernelTestCase
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

    public function testMigrationMappingRoundtripAndReversibility(): void
    {
        self::assertSame([], (new SchemaValidator($this->entityManager))->validateMapping());
        // Compare only identity-owned tables; transport and migration metadata
        // are managed by their own infrastructure and must never be dropped here.
        $expectedSchema = (new \Doctrine\ORM\Tools\SchemaTool($this->entityManager))->getSchemaFromMetadata($this->entityManager->getMetadataFactory()->getAllMetadata());
        $manager = $this->connection->createSchemaManager();
        $actualSchema = $manager->introspectSchema();
        foreach (['users', 'roles', 'user_roles'] as $table) {
            $difference = $manager->createComparator()->compareTables($actualSchema->getTable($table), $expectedSchema->getTable($table));
            self::assertSame([], $this->connection->getDatabasePlatform()->getAlterTableSQL($difference));
        }
        $metadata = $this->entityManager->getClassMetadata(UserRecord::class);
        self::assertSame(255, $metadata->getFieldMapping('email')->length ?? 255);
        $repository = new DoctrineUserRepository($this->entityManager);
        $role = $repository->saveRole(new Role(Role::USER));
        $profile = (new UserInputValidator(Validation::createValidator()))->validate(' Ana ', null, ' ANA@example.test ', '+34 (600) 123-456');
        $hasher = new SymfonyPasswordService();
        $user = $repository->save(new User($profile, $hasher->hash(' abcde'), [$role]));
        self::assertNotNull($user->id);
        $id = $user->id ?? throw new \LogicException('Missing generated ID.');
        $this->entityManager->clear();
        $loaded = $repository->findById($id);
        self::assertInstanceOf(User::class, $loaded);
        self::assertSame('Ana', $loaded->profile->firstName);
        self::assertNull($loaded->profile->lastName);
        self::assertSame(Role::USER, $loaded->roles[0]->name);
        self::assertSame($id, $repository->findByEmailComparison('ana@example.test')?->id);
        self::assertSame($id, $repository->findByPhone('+34600123456')?->id);
        $storedHash = $this->connection->fetchOne('SELECT password_hash FROM users WHERE id = ?', [$id]);
        self::assertIsString($storedHash);
        self::assertTrue($hasher->verify($storedHash, ' abcde'));
        self::assertFalse($hasher->verify($storedHash, 'abcde'));
        $columns = $this->connection->fetchAllAssociative('SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['users']);
        foreach ($columns as $column) {
            if ($column['COLUMN_NAME'] !== 'id') {
                self::assertSame(255, self::integer($column['CHARACTER_MAXIMUM_LENGTH']));
            }
            if ($column['COLUMN_NAME'] === 'email_comparison') {
                self::assertSame('utf8mb4_bin', $column['COLLATION_NAME']);
            }
        }
        self::assertSame(1, self::integer($this->connection->fetchOne("SELECT 'ana@example.test' COLLATE utf8mb4_bin <> 'ána@example.test' COLLATE utf8mb4_bin")));
        $this->migrate('0');
        self::assertFalse($this->connection->createSchemaManager()->tablesExist(['users']));
        $this->migrate('latest');
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
    }

    public function testDatabaseRejectsNormalizedEmailAndPhoneDuplicates(): void
    {
        $validator = new UserInputValidator(Validation::createValidator());
        $first = $validator->validate('Ana', null, 'ANA@example.test', '+34 600-123-456');
        $second = $validator->validate('Other', null, 'ana@example.test', '+34600123456');
        $this->connection->insert('users', ['first_name' => $first->firstName, 'email' => $first->email, 'email_comparison' => $first->emailComparison, 'phone' => $first->phone, 'password_hash' => 'fixture-hash-not-used-for-login']);
        foreach ([['email_comparison' => $second->emailComparison, 'phone' => '+12025550111'], ['email_comparison' => 'other@example.test', 'phone' => $second->phone]] as $duplicate) {
            try {
                $this->connection->insert('users', ['first_name' => 'Other', 'email' => 'other@example.test', 'password_hash' => 'fixture-hash-not-used-for-login'] + $duplicate);
                self::fail('Duplicate must be rejected by MySQL.');
            } catch (UniqueConstraintViolationException) {
                self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
            }
        }
    }

    public function testRoleAndMembershipUniqueness(): void
    {
        $this->connection->insert('roles', ['name' => Role::USER]);
        $roleId = (int) $this->connection->lastInsertId();
        try {
            $this->connection->insert('roles', ['name' => Role::USER]);
            self::fail('Duplicate role accepted.');
        } catch (UniqueConstraintViolationException) {
            self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        }
        $this->connection->insert('users', ['first_name' => 'Ana', 'email' => 'ana@example.test', 'email_comparison' => 'ana@example.test', 'phone' => '+34600123456', 'password_hash' => 'fixture-hash-not-used-for-login']);
        $userId = (int) $this->connection->lastInsertId();
        $this->connection->insert('user_roles', ['user_id' => $userId, 'role_id' => $roleId]);
        $this->expectException(UniqueConstraintViolationException::class);
        $this->connection->insert('user_roles', ['user_id' => $userId, 'role_id' => $roleId]);
    }
}
