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

final class OwnAccountTest extends KernelTestCase
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
        $this->http?->close();
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

    private ?\App\Tests\Support\SessionHttpClient $http = null;
    private string $fixtureHash = '';

    private function client(string $roleName = Role::USER): \App\Tests\Support\SessionHttpClient
    {
        $repository = new DoctrineUserRepository($this->entityManager);
        $role = $repository->saveRole(new Role($roleName));
        $profile = (new UserInputValidator(Validation::createValidator()))->validate('Ana', 'Pérez', 'Ana@example.test', '+34600123456');
        $this->fixtureHash = (new SymfonyPasswordService())->hash(' exact password ');
        $repository->save(new User($profile, $this->fixtureHash, [$role]));
        return $this->http = new \App\Tests\Support\SessionHttpClient();
    }

    public function testOwnPartialChangesKeepSessionRolesAndPasswordUnlessSupplied(): void
    {
        $http = $this->client();
        $token = $http->csrf();
        $http->request('POST', '/api/login', ['identifier' => 'Ana@example.test', 'password' => ' exact password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        $token = $http->csrf();
        $http->request('PATCH', '/api/me', ['firstName' => ' María ', 'lastName' => null], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        self::assertSame('María', $http->json()['firstName']);
        self::assertNull($http->json()['lastName']);
        self::assertSame([Role::USER], $http->json()['roles']);
        self::assertTrue($this->fixtureHash === $this->connection->fetchOne('SELECT password_hash FROM users'));
        $http->request('PATCH', '/api/me', ['email' => 'new@example.test', 'phone' => '+1 (202) 555-0101', 'password' => ' new password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        $http->request('GET', '/api/me');
        self::assertSame('new@example.test', $http->json()['email']);
        self::assertSame('+12025550101', $http->json()['phone']);
        self::assertSame(['id', 'firstName', 'lastName', 'email', 'phone', 'roles'], array_keys($http->json()));
        $hash = $this->connection->fetchOne('SELECT password_hash FROM users');
        self::assertIsString($hash);
        $hasher = new SymfonyPasswordService();
        self::assertTrue($hasher->verify($hash, ' new password '));
        self::assertFalse($hasher->verify($hash, ' exact password '));
        $http->request('POST', '/api/logout', [], ['X-CSRF-Token' => $token]);
        $token = $http->csrf();
        foreach ([['Ana@example.test', ' new password '], ['new@example.test', ' exact password ']] as [$identifier, $password]) {
            $http->request('POST', '/api/login', ['identifier' => $identifier, 'password' => $password], ['X-CSRF-Token' => $token]);
            self::assertSame(401, $http->status);
        }
        $http->request('POST', '/api/login', ['identifier' => '+12025550101', 'password' => ' new password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
    }
    public function testInvalidInputAndForgedIdentityNeverMutateAnyAccount(): void
    {
        $http = $this->client();
        $token = $http->csrf();
        $http->request('PATCH', '/api/me', ['firstName' => 'Changed'], ['X-CSRF-Token' => $token]);
        self::assertSame(401, $http->status);
        $http->request('POST', '/api/login', ['identifier' => 'Ana@example.test', 'password' => ' exact password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        $token = $http->csrf();
        $this->connection->insert('users', ['first_name' => 'Other', 'email' => 'other@example.test', 'email_comparison' => 'other@example.test', 'phone' => '+12025550101', 'password_hash' => 'synthetic-other-hash']);
        $snapshot = $this->connection->fetchAllAssociative('SELECT * FROM users ORDER BY id');
        foreach ([[], ['X-CSRF-Token' => 'wrong']] as $headers) {
            $http->request('PATCH', '/api/me', ['firstName' => 'Changed'], $headers);
            self::assertSame(403, $http->status);
        }
        $other = new \App\Tests\Support\SessionHttpClient();
        try {
            $http->request('PATCH', '/api/me', ['firstName' => 'Changed'], ['X-CSRF-Token' => $other->csrf()]);
            self::assertSame(403, $http->status);
        } finally {
            $other->close();
        }
        foreach ([['firstName', ' '], ['email', 'invalid'], ['phone', '0034600123456'], ['lastName', []], ['password', ''], ['password', null], ['password', 'abcde'], ['password', str_repeat('á', 2048).'a'], ['roles', [Role::SUPER_ADMIN]], ['id', 2], ['userId', 2], ['ownerId', 2], ['recipientId', 2]] as [$field, $value]) {
            $changes = ['firstName' => 'Changed']; $changes[$field] = $value;
            $http->request('PATCH', '/api/me', $changes, ['X-CSRF-Token' => $token]);
            self::assertSame(422, $http->status);
            $fields = $http->json()['fields']; self::assertIsArray($fields);
            self::assertArrayHasKey($field, $fields);
            self::assertTrue($snapshot === $this->connection->fetchAllAssociative('SELECT * FROM users ORDER BY id'), 'Invalid changes must preserve all accounts.');
        }
        $http->request('PATCH', '/api/me', [], ['X-CSRF-Token' => $token]);
        self::assertSame(422, $http->status);
        $http->request('PATCH', '/api/me', ['firstName' => 'Changed'], ['X-CSRF-Token' => $token, 'Content-Type' => 'text/plain']);
        self::assertSame(422, $http->status);
        $http->request('PATCH', '/api/me', ['firstName' => str_repeat('a', 256)], ['X-CSRF-Token' => $token]);
        self::assertSame(500, $http->status);
        self::assertStringNotContainsString('SQLSTATE', $http->body);
        self::assertTrue($snapshot === $this->connection->fetchAllAssociative('SELECT * FROM users ORDER BY id'), 'Storage failure must roll back changes.');
        $http->request('POST', '/api/users', ['firstName' => 'Forbidden']);
        self::assertSame(404, $http->status);
        self::assertSame(2, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
    }

    public function testAdminOwnChangesPreserveRoleAndDuplicatesAreFieldErrors(): void
    {
        $http = $this->client(Role::SUPER_ADMIN);
        $token = $http->csrf();
        $http->request('POST', '/api/login', ['identifier' => '+34600123456', 'password' => ' exact password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        $token = $http->csrf();
        $http->request('PATCH', '/api/me', ['firstName' => 'Admin', 'lastName' => '   ', 'email' => 'ANA@example.test'], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        self::assertNull($http->json()['lastName']);
        self::assertSame([Role::SUPER_ADMIN], $http->json()['roles']);
        $this->connection->insert('users', ['first_name' => 'Other', 'email' => 'other@example.test', 'email_comparison' => 'other@example.test', 'phone' => '+12025550101', 'password_hash' => 'synthetic-other-hash']);
        $snapshot = $this->connection->fetchAllAssociative('SELECT * FROM users ORDER BY id');
        foreach (['email' => ' OTHER@example.test ', 'phone' => '+1 (202) 555-0101'] as $field => $value) {
            $http->request('PATCH', '/api/me', ['firstName' => 'Changed', $field => $value], ['X-CSRF-Token' => $token]);
            self::assertSame(422, $http->status);
            $fields = $http->json()['fields']; self::assertIsArray($fields);
            self::assertArrayHasKey($field, $fields);
            self::assertTrue($snapshot === $this->connection->fetchAllAssociative('SELECT * FROM users ORDER BY id'), 'Duplicates must not partially update names or credentials.');
        }
        $password = str_repeat('á', 2048);
        $http->request('PATCH', '/api/me', ['password' => $password], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        self::assertSame([Role::SUPER_ADMIN], $http->json()['roles']);
        $hash = $this->connection->fetchOne('SELECT password_hash FROM users WHERE email_comparison = ?', ['ana@example.test']);
        self::assertIsString($hash);
        self::assertTrue((new SymfonyPasswordService())->verify($hash, $password));
        self::assertFalse($http->logsContain($password));
        self::assertFalse($http->logsContain($hash));
    }
}
