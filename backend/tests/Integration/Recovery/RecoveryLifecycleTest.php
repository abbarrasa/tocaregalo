<?php

declare(strict_types=1);

namespace App\Tests\Integration\Recovery;

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

final class RecoveryLifecycleTest extends KernelTestCase
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

    private function seed(string $roleName = Role::USER): int
    {
        $repository = new DoctrineUserRepository($this->entityManager);
        $role = $repository->saveRole(new Role($roleName));
        $profile = (new UserInputValidator(Validation::createValidator()))->validate('Ana', 'Pérez', 'ana@example.test', '+34600123456');
        $user = $repository->save(new User($profile, (new SymfonyPasswordService())->hash(' old password '), [$role]));
        return $user->id ?? throw new \LogicException('Missing ID.');
    }

    private function service(int $ttl = 3600, ?\App\Application\Port\PasswordService $hasher = null): \App\Application\Recovery\RecoveryTokens
    {
        return new \App\Application\Recovery\RecoveryTokens(new \App\Infrastructure\Doctrine\DoctrineRecoveryStore($this->connection), $hasher ?? new SymfonyPasswordService(), $this->clock, new \App\Application\Recovery\RecoveryLifetime($ttl));
    }

    private \App\Tests\Support\RecoveryClock $clock;

    public function testExpirySupersessionConfigurationAndHashOnlyStorage(): void
    {
        $this->clock = new \App\Tests\Support\RecoveryClock(new \DateTimeImmutable('2026-11-18T12:00:00Z'));
        $id = $this->seed();
        $service = $this->service();
        $first = $service->issue($id);
        self::assertSame(3600, $first->expiresAt->getTimestamp() - $this->clock->now()->getTimestamp());
        $second = $this->service(90)->issue($id);
        self::assertSame(90, $second->expiresAt->getTimestamp() - $this->clock->now()->getTimestamp());
        self::assertTrue($first->token !== $second->token);
        $rows = $this->connection->fetchAllAssociative('SELECT * FROM password_reset_requests');
        self::assertCount(2, $rows);
        foreach ($rows as $row) {
            $snapshot = json_encode($row, JSON_THROW_ON_ERROR);
            self::assertFalse(str_contains($snapshot, $first->token));
            self::assertFalse(str_contains($snapshot, $second->token));
        }
        self::assertSame(hash('sha256', $second->token), $rows[1]['token_hash']);
        $this->rejects($service, $first->token);
        $this->clock->instant = $second->expiresAt;
        $this->rejects($service, $second->token);
        $third = $service->issue($id);
        $this->clock->instant = $third->expiresAt->modify('-1 second');
        $service->reset($third->token, ' new password ');
        $this->rejects($service, $third->token);
        $fourth = $service->issue($id);
        $this->clock->instant = $fourth->expiresAt->modify('+1 second');
        $this->rejects($service, $fourth->token);
        $this->rejects($service, 'malformed');
        $this->rejects($service, str_repeat('a', 43));
        self::assertTrue((new SymfonyPasswordService())->verify($this->hash(), ' new password '));
        self::assertSame([], (new SchemaValidator($this->entityManager))->validateMapping());
        $expected = (new \Doctrine\ORM\Tools\SchemaTool($this->entityManager))->getSchemaFromMetadata($this->entityManager->getMetadataFactory()->getAllMetadata());
        $manager = $this->connection->createSchemaManager();
        $difference = $manager->createComparator()->compareTables($manager->introspectTable("password_reset_requests"), $expected->getTable("password_reset_requests"));
        self::assertSame([], $this->connection->getDatabasePlatform()->getAlterTableSQL($difference));
    }

    private function rejects(\App\Application\Recovery\RecoveryTokens $service, #[\SensitiveParameter] string $token): void
    {
        $before = $this->hash();
        try {
            $service->reset($token, ' unwanted password ');
            self::fail('Inactive token accepted.');
        } catch (\App\Application\Recovery\InvalidRecoveryToken $exception) {
            self::assertFalse(str_contains($exception->getMessage(), $token));
            self::assertTrue($before === $this->hash());
        }
    }

    private function hash(): string
    {
        $hash = $this->connection->fetchOne('SELECT password_hash FROM users LIMIT 1');
        return is_string($hash) ? $hash : throw new \LogicException('Missing hash.');
    }

    public function testInvalidPasswordsRollbackAndValidResetPermitsNativeLoginForBothRoles(): void
    {
        foreach ([Role::USER, Role::SUPER_ADMIN] as $role) {
            $this->clock = new \App\Tests\Support\RecoveryClock(new \DateTimeImmutable('2026-11-18T12:00:00Z'));
            $id = $this->seed($role);
            $service = $this->service();
            $issued = $service->issue($id);
            $before = $this->hash();
            foreach (['12345', str_repeat('a', 4097), str_repeat('á', 2048).'a'] as $password) {
                try {
                    $service->reset($issued->token, $password);
                    self::fail('Invalid password accepted.');
                } catch (\InvalidArgumentException) {
                    self::assertTrue($before === $this->hash());
                    self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM password_reset_requests'));
                }
            }
            $profile = $this->connection->fetchAssociative('SELECT first_name, last_name, email, phone FROM users');
            $service->reset($issued->token, ' new password ');
            self::assertSame($profile, $this->connection->fetchAssociative('SELECT first_name, last_name, email, phone FROM users'));
            $http = new \App\Tests\Support\SessionHttpClient();
            try {
                $csrf = $http->csrf();
                $http->request('POST', '/api/login', ['identifier' => 'ana@example.test', 'password' => ' old password '], ['X-CSRF-Token' => $csrf]);
                self::assertSame(401, $http->status);
                $http->request('POST', '/api/login', ['identifier' => 'ana@example.test', 'password' => ' new password '], ['X-CSRF-Token' => $csrf]);
                self::assertSame(200, $http->status);
                self::assertSame([$role], $http->json()['roles']);
                self::assertFalse($http->logsContain($issued->token));
                self::assertFalse($http->logsContain($this->hash()));
            } finally {
                $http->close();
            }
            foreach (['123456', str_repeat('a', 4096), str_repeat('á', 2048)] as $password) {
                $next = $service->issue($id);
                $service->reset($next->token, $password);
                self::assertTrue((new SymfonyPasswordService())->verify($this->hash(), $password));
            }
            $this->connection->executeStatement('DELETE FROM users WHERE id = ?', [$id]);
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM password_reset_requests')));
            $this->rejectDeleted($service, $issued->token, $id);
        }
    }

    private function rejectDeleted(\App\Application\Recovery\RecoveryTokens $service, string $token, int $id): void
    {
        foreach ([static fn () => $service->reset($token, ' valid password '), static fn () => $service->issue($id)] as $operation) {
            try {
                $operation();
                self::fail('Deleted account accepted.');
            } catch (\App\Application\Recovery\InvalidRecoveryToken) {
                self::addToAssertionCount(1);
            }
        }
    }

    public function testDatabaseFailureRollsBackPasswordAndConsumptionOrSupersession(): void
    {
        $this->clock = new \App\Tests\Support\RecoveryClock(new \DateTimeImmutable('2026-11-18T12:00:00Z'));
        $id = $this->seed();
        $service = $this->service();
        $issued = $service->issue($id);
        $before = $this->hash();
        $this->connection->executeStatement("ALTER TABLE password_reset_requests ADD CONSTRAINT fixture_consume_failure CHECK (consumed_at IS NULL)");
        try {
            $service->reset($issued->token, ' rollback password ');
            self::fail('Expected storage failure.');
        } catch (\Doctrine\DBAL\Exception) {
            self::assertTrue($before === $this->hash());
            self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM password_reset_requests'));
        } finally {
            $this->connection->executeStatement('ALTER TABLE password_reset_requests DROP CHECK fixture_consume_failure');
        }
        $this->connection->executeStatement("ALTER TABLE password_reset_requests ADD CONSTRAINT fixture_issue_failure CHECK (expires_at <= '2026-11-18 13:00:00')");
        $this->clock->instant = $this->clock->instant->modify("+1 second");
        try {
            $service->issue($id);
            self::fail('Expected storage failure.');
        } catch (\Doctrine\DBAL\Exception) {
            self::assertNull($this->connection->fetchOne('SELECT superseded_at FROM password_reset_requests'));
            self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM password_reset_requests')));
        } finally {
            $this->connection->executeStatement('ALTER TABLE password_reset_requests DROP CHECK fixture_issue_failure');
        }
        $service->reset($issued->token, ' after rollback ');
        self::assertTrue((new SymfonyPasswordService())->verify($this->hash(), ' after rollback '));
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function races(): iterable
    {
        yield 'consume twice' => ['reset', 'reset', 'inactive'];
        yield 'issue before old consume' => ['issue', 'reset', 'inactive'];
        yield 'consume before issue' => ['reset', 'issue', 'success'];
        yield 'issue twice' => ['issue', 'issue', 'success'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('races')]
    public function testRealConnectionsSerializeLifecycle(string $firstOperation, string $secondOperation, string $secondResult): void
    {
        $this->clock = new \App\Tests\Support\RecoveryClock(new \DateTimeImmutable('2026-11-18T12:00:00Z'));
        $id = $this->seed();
        $issued = $this->service()->issue($id);
        $directory = sys_get_temp_dir().'/recovery-race-'.bin2hex(random_bytes(8));
        mkdir($directory, 0700);
        $processes = [];
        $outputs = [];
        try {
            foreach ([[$firstOperation, true], [$secondOperation, false]] as $index => [$operation, $hold]) {
                $output = tmpfile();
                if ($output === false) {
                    throw new \RuntimeException('Could not create fixture output.');
                }
                $outputs[] = $output;
                $pipes = [];
                $process = proc_open([PHP_BINARY, dirname(__DIR__, 2).'/Fixtures/Recovery/race.php'], [0 => ['pipe', 'r'], 1 => $output, 2 => $output], $pipes);
                if (!is_resource($process)) {
                    throw new \RuntimeException('Could not start fixture.');
                }
                $processes[] = $process;
                fwrite($pipes[0], json_encode(['directory' => $directory, 'operation' => $operation, 'hold' => $hold, 'userId' => $id, 'token' => $issued->token], JSON_THROW_ON_ERROR));
                fclose($pipes[0]);
                $this->awaitFile($directory.'/'.($index === 0 ? 'ready' : 'started'));
            }
            // The first connection holds the real user row lock; the competing operation cannot finish.
            usleep(200000);
            self::assertTrue(proc_get_status($processes[1])['running']);
            rewind($outputs[1]);
            self::assertSame('', stream_get_contents($outputs[1]));
            touch($directory.'/go');
            foreach ($processes as $index => $process) {
                $deadline = microtime(true) + 30;
                do {
                    $status = proc_get_status($process);
                    if (!$status['running']) {
                        break;
                    }
                    usleep(10000);
                } while (microtime(true) < $deadline);
                self::assertFalse($status['running'], 'Fixture did not finish.');
                self::assertSame(0, $status['exitcode']);
                rewind($outputs[$index]);
                self::assertSame($index === 0 ? 'success' : $secondResult, stream_get_contents($outputs[$index]));
            }
            if ($firstOperation === 'issue' || $secondOperation === 'issue') {
                self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM password_reset_requests WHERE superseded_at IS NULL AND consumed_at IS NULL')));
            } else {
                self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM password_reset_requests WHERE consumed_at IS NOT NULL')));
            }
            $this->rejects($this->service(), $issued->token);
        } finally {
            foreach ($processes as $process) {
                if (proc_get_status($process)['running']) {
                    proc_terminate($process, 9);
                }
                proc_close($process);
            }
            foreach ($outputs as $output) {
                fclose($output);
            }
            foreach (['ready', 'started', 'go'] as $file) {
                if (is_file($directory.'/'.$file)) {
                    unlink($directory.'/'.$file);
                }
            }
            rmdir($directory);
        }
    }

    private function awaitFile(string $path): void
    {
        $deadline = microtime(true) + 30;
        while (!is_file($path)) {
            if (microtime(true) > $deadline) {
                throw new \RuntimeException('Fixture readiness timeout.');
            }
            usleep(10000);
        }
    }
}
