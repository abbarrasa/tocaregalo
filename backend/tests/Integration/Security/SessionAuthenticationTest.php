<?php

declare(strict_types=1);

namespace App\Tests\Integration\Security;

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

final class SessionAuthenticationTest extends KernelTestCase
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

    public function testEmailLoginPersistsRotatesAndLogoutRejectsReplay(): void
    {
        $http = $this->client();
        $http->request("GET", "/api/me");
        self::assertSame(401, $http->status);
        $cookieHeaders = $http->headers;
        $token = $http->csrf();
        $anonymousCookie = $http->cookie;
        self::assertNotSame('', $anonymousCookie);
        self::assertStringContainsString('httponly', strtolower(implode(';', $cookieHeaders)));
        self::assertStringContainsString('samesite=lax', strtolower(implode(';', $cookieHeaders)));
        self::assertStringNotContainsString('; secure', strtolower(implode(';', $cookieHeaders)));
        $http->request('POST', '/api/login', ['identifier' => ' ANA@example.test ', 'password' => ' exact password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        self::assertSame('Pérez', $http->json()['lastName']);
        self::assertSame([Role::USER], $http->json()['roles']);
        self::assertNotSame($anonymousCookie, $http->cookie);
        $authenticatedCookie = $http->cookie;
        $http->request('GET', '/api/me');
        self::assertSame(200, $http->status);
        self::assertSame(['id', 'firstName', 'lastName', 'email', 'phone', 'roles'], array_keys($http->json()));
        $session = $this->connection->fetchOne('SELECT sess_data FROM sessions WHERE sess_id = ?', [substr($http->cookie, strlen('TOCAREGALO_SESSION='))]);
        self::assertIsString($session);
        self::assertGreaterThan(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM sessions')));
        self::assertNotSame('', $session);
        self::assertFalse(str_contains($session, $this->fixtureHash), 'Session must not store the password hash.');
        self::assertFalse(str_contains($session, ' exact password '), 'Session must not store plaintext credentials.');
        $token = $http->csrf();
        $http->request('POST', '/api/logout', [], ['X-CSRF-Token' => $token]);
        self::assertSame(204, $http->status);
        self::assertStringContainsString('Max-Age=0', implode(';', $http->headers));
        $http->cookie = $authenticatedCookie;
        $http->request('GET', '/api/me');
        self::assertSame(401, $http->status);
        $http->cookie = $anonymousCookie;
        $http->request('GET', '/api/me');
        self::assertSame(401, $http->status);
        $token = $http->csrf();
        $http->request('POST', '/api/login', ['identifier' => '+34 (600) 123-456', 'password' => ' exact password '], ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        self::assertFalse($http->logsContain($this->fixtureHash), 'Logs must not contain the password hash.');
        self::assertFalse($http->logsContain(' exact password '), 'Logs must not contain plaintext credentials.');
    }

    public function testCsrfBadCredentialsAndForgedPrivilegesFailClosed(): void
    {
        $http = $this->client();
        $token = $http->csrf();
        $data = ['identifier' => 'Ana@example.test', 'password' => ' exact password '];
        foreach ([[], ['X-CSRF-Token' => 'wrong']] as $headers) {
            $http->request('POST', '/api/login', $data, $headers);
            self::assertSame(403, $http->status);
        }
        $other = new \App\Tests\Support\SessionHttpClient();
        try {
            $other->request('GET', '/api/me');
            self::assertSame(401, $other->status);
            $otherToken = $other->csrf();
            $http->request('POST', '/api/login', $data, ['X-CSRF-Token' => $otherToken]);
            self::assertSame(403, $http->status);
        } finally {
            $other->close();
        }
        foreach (['wrong', 'exact password'] as $password) {
            $http->request('POST', '/api/login', ['identifier' => 'Ana@example.test', 'password' => $password], ['X-CSRF-Token' => $token]);
            self::assertSame(401, $http->status);
        }
        foreach (['nobody@example.test', 'malformed'] as $identifier) {
            $http->request('POST', '/api/login', ['identifier' => $identifier, 'password' => 'wrong'], ['X-CSRF-Token' => $token]);
            self::assertSame(401, $http->status);
            self::assertStringContainsString('Credenciales', $http->body);
        }
        foreach (['roles' => [Role::SUPER_ADMIN], 'ownerId' => 1, 'recipientId' => 1, 'userId' => 1] as $field => $value) {
            $http->request('POST', '/api/login', $data + [$field => $value], ['X-CSRF-Token' => $token]);
            self::assertSame(422, $http->status);
        }
        $http->request('POST', '/api/login', ['identifier' => []], ['X-CSRF-Token' => $token]);
        self::assertSame(422, $http->status);
        $http->request('POST', '/api/login', $data, ['X-CSRF-Token' => $token, 'Content-Type' => 'text/plain']);
        self::assertSame(422, $http->status);
        $http->request('GET', '/api/login');
        self::assertSame(405, $http->status);
        $http->request('GET', '/api/logout');
        self::assertSame(405, $http->status);
        $http->request('POST', '/api/register', []);
        self::assertSame(404, $http->status);
        $http->request('POST', '/api/login', $data, ['X-CSRF-Token' => $token]);
        self::assertSame(200, $http->status);
        $http->request('POST', '/api/logout', []);
        self::assertSame(403, $http->status);
        $http->request('GET', '/api/me');
        self::assertSame(200, $http->status);
        self::assertSame([Role::USER], $http->json()['roles']);
    }

    public function testAdminPrincipalIsRefreshedAndMissingUserLosesAccess(): void
    {
        $http = $this->client(Role::SUPER_ADMIN);
        $http->request('GET', '/api/csrf', headers: ['X-Fixture-HTTPS' => '1']);
        self::assertStringContainsString('; secure', strtolower(implode(';', $http->headers)));
        $token = $http->json()['csrfToken'];
        self::assertIsString($token);
        $http->request('POST', '/api/login', ['identifier' => '+34600123456', 'password' => ' exact password '], ['X-CSRF-Token' => $token, 'X-Fixture-HTTPS' => '1']);
        self::assertSame(200, $http->status);
        self::assertSame([Role::SUPER_ADMIN], $http->json()['roles']);
        $this->connection->executeStatement('UPDATE roles SET name = ? WHERE name = ?', [Role::USER, Role::SUPER_ADMIN]);
        $http->request('GET', '/api/me', headers: ['X-Fixture-HTTPS' => '1']);
        self::assertSame(401, $http->status);
        $http->request('GET', '/api/csrf', headers: ['X-Fixture-HTTPS' => '1']);
        $freshToken = $http->json()['csrfToken'];
        self::assertIsString($freshToken);
        $http->request('POST', '/api/login', ['identifier' => '+34600123456', 'password' => ' exact password '], ['X-CSRF-Token' => $freshToken, 'X-Fixture-HTTPS' => '1']);
        self::assertSame(200, $http->status);
        self::assertSame([Role::USER], $http->json()['roles']);
        $this->connection->executeStatement('DELETE FROM users');
        $http->request('GET', '/api/me', headers: ['X-Fixture-HTTPS' => '1']);
        self::assertSame(401, $http->status);
    }
}
