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

#[\PHPUnit\Framework\Attributes\Group("mail")]
final class RecoveryDeliveryTest extends KernelTestCase
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

    /** @return iterable<string, array{string}> */
    public static function accountRoles(): iterable
    {
        yield "ordinary" => [Role::USER];
        yield "super admin" => [Role::SUPER_ADMIN];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider("accountRoles")]
    public function testCapturedRecoveryLinkResetsPasswordWithoutTokenDisclosure(string $roleName): void
    {
        $id = $this->seed($roleName);
        $http = new \App\Tests\Support\SessionHttpClient();
        try {
            $csrf = $http->csrf();
            $http->request('POST', '/api/password-recovery', ['identifier' => 'ana@example.test'], ['X-CSRF-Token' => $csrf]);
            self::assertSame(202, $http->status);
            $ack = $http->body;
            self::assertSame(['message'], array_keys($http->json()));
            $http->request('POST', '/api/password-recovery', ['identifier' => 'unknown@example.test'], ['X-CSRF-Token' => $csrf]);
            self::assertSame(202, $http->status);
            self::assertSame($ack, $http->body);
            self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM recovery_deliveries')));
            $this->worker();
            $captured = $this->capture();
            $token = $this->token($captured);
            self::assertFalse(str_contains($ack, $token));
            foreach (['password_reset_requests', 'recovery_deliveries', 'messenger_messages'] as $table) {
                self::assertFalse(str_contains(json_encode($this->connection->fetchAllAssociative('SELECT * FROM '.$table), JSON_THROW_ON_ERROR), $token));
            }
            self::assertSame('sent', $this->connection->fetchOne('SELECT state FROM recovery_deliveries'));
            self::assertNull($this->connection->fetchOne('SELECT ciphertext FROM recovery_deliveries'));
            $http->request('POST', '/api/password-reset', ['token' => $token, 'password' => '12345'], ['X-CSRF-Token' => $csrf]);
            self::assertSame(422, $http->status);
            $fields = $http->json()['fields'];
            self::assertIsArray($fields);
            self::assertArrayHasKey('password', $fields);
            $http->request('POST', '/api/password-reset', ['token' => $token, 'password' => ' new password '], ['X-CSRF-Token' => $csrf]);
            self::assertSame(204, $http->status);
            $http->request('POST', '/api/password-reset', ['token' => $token, 'password' => ' unwanted password '], ['X-CSRF-Token' => $csrf]);
            self::assertSame(422, $http->status);
            $http->request('POST', '/api/login', ['identifier' => 'ana@example.test', 'password' => ' old password '], ['X-CSRF-Token' => $csrf]);
            self::assertSame(401, $http->status);
            $http->request('POST', '/api/login', ['identifier' => 'ana@example.test', 'password' => ' new password '], ['X-CSRF-Token' => $csrf]);
            self::assertSame(200, $http->status);
            self::assertSame($id, $http->json()['id']);
            self::assertSame([$roleName], $http->json()['roles']);
            self::assertFalse($http->logsContain($token));
        } finally {
            $http->close();
        }
    }

    private function worker(): void
    {
        $result = \App\Tests\Support\NativeProcess::run([PHP_BINARY, 'bin/console', 'messenger:consume', 'notifications', '--limit=1', '--time-limit=4', '--sleep=0.01', '--no-interaction', '--quiet'], 15);
        self::assertSame(0, $result['exit'], 'Recovery worker must exit successfully.');
    }

    /** @return array<array-key, mixed> */
    private function capture(): array
    {
        $list = $this->captureJson('/api/v1/messages');
        $messages = $list['messages'] ?? [];
        self::assertIsArray($messages);
        foreach ($messages as $message) {
            if (is_array($message) && ($message['Subject'] ?? '') === 'Recupera tu contraseña de Toca Regalo' && is_string($message['ID'] ?? null)) {
                return $this->captureJson('/api/v1/message/'.rawurlencode($message['ID']));
            }
        }
        throw new \RuntimeException('Recovery email not captured.');
    }

    /** @param array<array-key, mixed> $message */
    private function token(array $message): string
    {
        $text = $message['Text'] ?? null;
        self::assertIsString($text);
        self::assertSame(1, preg_match('/#token=([A-Za-z0-9_-]{43})/', $text, $matches), 'Capture must contain a fragment link.');
        return $matches[1];
    }

    /** @return array<array-key, mixed> */
    private function captureJson(string $path): array
    {
        \App\Tests\Fixtures\Mail\MailFixture::assertLocal('test', \App\Tests\Support\TestDatabase::environment('MAILER_DSN'));
        $body = file_get_contents('http://tocaregalo-mailpit:8025'.$path);
        if (!is_string($body)) {
            throw new \RuntimeException('No capture response.');
        }
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        return is_array($decoded) ? $decoded : throw new \RuntimeException('Invalid capture response.');
    }

    private function requestService(): \App\Application\Recovery\RequestRecovery
    {
        $service = self::getContainer()->get(\App\Application\Recovery\RequestRecovery::class);
        self::assertInstanceOf(\App\Application\Recovery\RequestRecovery::class, $service);
        return $service;
    }

    private function deliveryStore(): \App\Infrastructure\Mail\RecoveryDeliveryStore
    {
        $store = self::getContainer()->get(\App\Infrastructure\Mail\RecoveryDeliveryStore::class);
        self::assertInstanceOf(\App\Infrastructure\Mail\RecoveryDeliveryStore::class, $store);
        return $store;
    }

    public function testIssuanceQueueFailuresRollbackAndStaleWorkIsPurged(): void
    {
        $id = $this->seed();
        $service = $this->requestService();
        $service->request('ana@example.test');
        $before = $this->connection->fetchAllAssociative('SELECT * FROM password_reset_requests');
        $delivery = $this->connection->fetchAllAssociative('SELECT * FROM recovery_deliveries');
        $this->connection->executeStatement('DELETE FROM messenger_messages');
        $this->connection->executeStatement("ALTER TABLE messenger_messages ADD CONSTRAINT fixture_reject_enqueue CHECK (queue_name <> 'notifications')");
        try {
            $service->request('ana@example.test');
            self::fail('Expected enqueue failure.');
        } catch (\Doctrine\DBAL\Exception|\Symfony\Component\Messenger\Exception\TransportException) {
            self::assertSame($before, $this->connection->fetchAllAssociative('SELECT * FROM password_reset_requests'));
            self::assertTrue($delivery === $this->connection->fetchAllAssociative('SELECT * FROM recovery_deliveries'));
        } finally {
            $this->connection->executeStatement('ALTER TABLE messenger_messages DROP CHECK fixture_reject_enqueue');
        }
        $this->connection->executeStatement('ALTER TABLE recovery_deliveries ADD CONSTRAINT fixture_reject_work CHECK (request_id = 1)');
        try {
            $service->request('ana@example.test');
            self::fail('Expected work insertion failure.');
        } catch (\Doctrine\DBAL\Exception|\Symfony\Component\Messenger\Exception\TransportException) {
            self::assertSame($before, $this->connection->fetchAllAssociative('SELECT * FROM password_reset_requests'));
            self::assertTrue($delivery === $this->connection->fetchAllAssociative('SELECT * FROM recovery_deliveries'));
        } finally {
            $this->connection->executeStatement('ALTER TABLE recovery_deliveries DROP CHECK fixture_reject_work');
        }
        $service->request('ana@example.test');
        self::assertSame('cancelled', $this->connection->fetchOne('SELECT state FROM recovery_deliveries WHERE id = 1'));
        self::assertNull($this->connection->fetchOne('SELECT ciphertext FROM recovery_deliveries WHERE id = 1'));
        $this->connection->executeStatement("UPDATE password_reset_requests SET expires_at = '2000-01-01 00:00:00'");
        $this->deliveryStore()->cleanup();
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM recovery_deliveries WHERE ciphertext IS NOT NULL')));
        $service->request('ana@example.test');
        $this->connection->executeStatement('DELETE FROM users WHERE id = ?', [$id]);
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM recovery_deliveries')));
        $this->worker();
    }

    public function testRestartRetryPreservesTokenAndFinalFailurePurgesIt(): void
    {
        $this->seed();
        $this->requestService()->request('ana@example.test');
        $before = $this->connection->fetchAssociative('SELECT * FROM recovery_deliveries');
        self::assertIsArray($before);
        $digest = $this->connection->fetchOne('SELECT token_hash FROM password_reset_requests');
        $result = \App\Tests\Support\NativeProcess::run(['env', 'MAILER_DSN=smtp://127.0.0.1:1', 'NOTIFICATION_RETRY_BASE_MS=1', PHP_BINARY, 'bin/console', 'messenger:consume', 'notifications', '--limit=1', '--time-limit=5', '--sleep=0.01', '--no-interaction', '--quiet'], 15);
        self::assertSame(0, $result['exit']);
        $after = $this->connection->fetchAssociative('SELECT * FROM recovery_deliveries');
        self::assertIsArray($after);
        foreach (['ciphertext', 'nonce', 'message_id', 'request_id'] as $field) {
            self::assertTrue($before[$field] === $after[$field]);
        }
        self::assertSame('retrying', $after['state']);
        self::assertSame(1, self::integer($after['retry_count']));
        // Simulate a crash after Messenger re-enqueues but before the retry projection commits.
        $this->connection->executeStatement("UPDATE recovery_deliveries SET attempts = 0, retry_count = 0, state = 'pending', next_due_at = NULL");
        $this->worker();
        $token = $this->token($this->capture());
        self::assertTrue(hash('sha256', $token) === $digest);
        self::assertFalse(str_contains($result['output'], $token));
        self::assertSame('sent', $this->connection->fetchOne('SELECT state FROM recovery_deliveries'));
        self::assertSame(2, self::integer($this->connection->fetchOne('SELECT attempts FROM recovery_deliveries')));
        self::assertSame(1, self::integer($this->connection->fetchOne('SELECT retry_count FROM recovery_deliveries')));
        $this->requestService()->request('ana@example.test');
        $result = \App\Tests\Support\NativeProcess::run(['env', 'MAILER_DSN=smtp://127.0.0.1:1', 'NOTIFICATION_RETRY_BASE_MS=1', PHP_BINARY, 'bin/console', 'messenger:consume', 'notifications', '--limit=6', '--time-limit=8', '--sleep=0.01', '--no-interaction', '--quiet'], 18);
        self::assertSame(0, $result['exit']);
        $failed = $this->connection->fetchAssociative('SELECT * FROM recovery_deliveries ORDER BY id DESC LIMIT 1');
        self::assertIsArray($failed);
        self::assertSame('failed', $failed['state']);
        self::assertSame(6, self::integer($failed['attempts']));
        self::assertSame(5, self::integer($failed['retry_count']));
        self::assertNull($failed['ciphertext']);
        self::assertNull($failed['nonce']);
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM messenger_messages')));
    }

    public function testCsrfStrictFieldsAndProtectedDataFailuresNeverSend(): void
    {
        $this->seed();
        $http = new \App\Tests\Support\SessionHttpClient();
        try {
            $http->request('POST', '/api/password-recovery', ['identifier' => 'ana@example.test']);
            self::assertSame(403, $http->status);
            $csrf = $http->csrf();
            foreach ([[], ['identifier' => null], ['identifier' => 'bad'], ['identifier' => 'ana@example.test', 'userId' => 1]] as $values) {
                $http->request('POST', '/api/password-recovery', $values, ['X-CSRF-Token' => $csrf]);
                self::assertSame(422, $http->status);
            }
            $http->request('POST', '/api/password-recovery', ['identifier' => '+34 (600) 123-456'], ['X-CSRF-Token' => $csrf]);
            self::assertSame(202, $http->status);
            $this->connection->executeStatement("UPDATE recovery_deliveries SET ciphertext = 'tampered'");
            $this->worker();
            self::assertSame('failed', $this->connection->fetchOne('SELECT state FROM recovery_deliveries'));
            self::assertNull($this->connection->fetchOne('SELECT ciphertext FROM recovery_deliveries'));
        } finally {
            $http->close();
        }
    }

    /** @return iterable<string, array{bool}> */
    public static function smtpRaces(): iterable
    {
        yield 'duplicate actual workers' => [false];
        yield 'reset during SMTP handoff' => [true];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('smtpRaces')]
    public function testRealSmtpHandoffSerializesCompetingOperations(bool $reset): void
    {
        $this->seed();
        $this->requestService()->request('ana@example.test');
        $row = $this->connection->fetchAssociative('SELECT * FROM recovery_deliveries');
        self::assertIsArray($row);
        $id = self::integer($row['id']);
        $requestId = self::integer($row['request_id']);
        $key = $_SERVER['RECOVERY_DELIVERY_KEY'] ?? null;
        self::assertIsString($key);
        self::assertIsString($row['ciphertext']);
        self::assertIsString($row['nonce']);
        $token = (new \App\Infrastructure\Mail\RecoveryEnvelope($key))->open(['version' => 1, 'ciphertext' => $row['ciphertext'], 'nonce' => $row['nonce']], $requestId, $id);
        $directory = sys_get_temp_dir().'/recovery-smtp-'.bin2hex(random_bytes(8));
        mkdir($directory, 0700);
        $processes = [];
        $outputs = [];
        try {
            /** @param list<string> $arguments
             * @return resource
             */
            $start = static function (array $arguments, ?string $input = null) use (&$processes, &$outputs) {
                $command = [];
                foreach ($arguments as $argument) {
                    if (!is_string($argument)) {
                        throw new \LogicException('Fixture arguments must be strings.');
                    }
                    $command[] = $argument;
                }
                $output = tmpfile();
                if ($output === false) {
                    throw new \RuntimeException('Missing process output.');
                }
                $pipes = [];
                $process = proc_open($command, [0 => ['pipe', 'r'], 1 => $output, 2 => $output], $pipes, dirname(__DIR__, 3));
                if (!is_resource($process)) {
                    fclose($output);
                    throw new \RuntimeException('Cannot start SMTP race process.');
                }
                $processes[] = $process;
                $outputs[] = $output;
                if ($input !== null) {
                    fwrite($pipes[0], $input);
                }
                fclose($pipes[0]);
                return $process;
            };
            $start([PHP_BINARY, 'tests/Fixtures/Recovery/smtp-barrier.php', $directory]);
            $this->awaitPath($directory.'/address');
            $address = file_get_contents($directory.'/address');
            self::assertIsString($address);
            $arguments = ['env', 'MAILER_DSN=smtp://'.$address, PHP_BINARY, 'bin/console', 'messenger:consume', 'notifications', '--limit=1', '--time-limit=12', '--sleep=0.01', '--no-interaction', '--quiet'];
            $start($arguments);
            $this->awaitPath($directory.'/ready');
            if ($reset) {
                $competing = $start([PHP_BINARY, 'tests/Fixtures/Recovery/consume-current.php'], json_encode(['directory' => $directory, 'token' => $token], JSON_THROW_ON_ERROR));
                $this->awaitPath($directory.'/consumer');
                usleep(100000);
                self::assertTrue(proc_get_status($competing)['running']);
                self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM password_reset_requests'));
            } else {
                $bus = self::getContainer()->get(\Symfony\Component\Messenger\MessageBusInterface::class);
                self::assertInstanceOf(\Symfony\Component\Messenger\MessageBusInterface::class, $bus);
                $bus->dispatch(new \App\Infrastructure\Mail\RecoveryMail($id));
                $start($arguments);
                $deadline = microtime(true) + 15;
                do {
                    $claimed = self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM messenger_messages WHERE delivered_at IS NOT NULL'));
                    if ($claimed === 2) {
                        break;
                    }
                    usleep(10000);
                } while (microtime(true) < $deadline);
                self::assertSame(2, $claimed, 'Both real workers must have claimed their messages.');
            }
            touch($directory.'/go');
            foreach ($processes as $process) {
                $deadline = microtime(true) + 20;
                do {
                    $status = proc_get_status($process);
                    if (!$status['running']) {
                        break;
                    }
                    usleep(10000);
                } while (microtime(true) < $deadline);
                self::assertFalse($status['running']);
                self::assertSame(0, $status['exitcode']);
            }
            foreach ($outputs as $output) {
                rewind($output);
                self::assertFalse(str_contains(stream_get_contents($output), $token));
            }
            self::assertSame('sent', $this->connection->fetchOne('SELECT state FROM recovery_deliveries'));
            self::assertSame(1, self::integer($this->connection->fetchOne('SELECT attempts FROM recovery_deliveries')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM messenger_messages')));
            if ($reset) {
                self::assertNotNull($this->connection->fetchOne('SELECT consumed_at FROM password_reset_requests'));
            }
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
            foreach (['address', 'ready', 'go', 'consumer'] as $name) {
                if (is_file($directory.'/'.$name)) {
                    unlink($directory.'/'.$name);
                }
            }
            rmdir($directory);
        }
    }

    private function awaitPath(string $path): void
    {
        $deadline = microtime(true) + 20;
        while (!is_file($path)) {
            if (microtime(true) > $deadline) {
                throw new \RuntimeException('SMTP fixture readiness timeout.');
            }
            usleep(10000);
        }
    }

    public function testExplicitTransportSchemaAndMissingKeyRollback(): void
    {
        $this->seed();
        $transport = self::getContainer()->get('messenger.transport.notifications');
        self::assertInstanceOf(\Symfony\Component\Messenger\Bridge\Doctrine\Transport\DoctrineTransport::class, $transport);
        $expected = $transport->configureSchema(new \Doctrine\DBAL\Schema\Schema(), $this->connection, static fn (): bool => true);
        $manager = $this->connection->createSchemaManager();
        $difference = $manager->createComparator()->compareTables($manager->introspectTable('messenger_messages'), $expected->getTable('messenger_messages'));
        self::assertSame([], $this->connection->getDatabasePlatform()->getAlterTableSQL($difference));
        $work = $manager->introspectTable('recovery_deliveries');
        self::assertFalse($work->hasColumn('token'));
        self::assertFalse($work->hasColumn('link'));
        self::assertFalse($work->getColumn('ciphertext')->getNotnull());
        foreach ($work->getForeignKeys() as $foreignKey) {
            self::assertSame('CASCADE', $foreignKey->onDelete());
        }
        $key = getenv('RECOVERY_DELIVERY_KEY');
        putenv('RECOVERY_DELIVERY_KEY=');
        $http = new \App\Tests\Support\SessionHttpClient();
        try {
            $csrf = $http->csrf();
            $body = null;
            foreach (['ana@example.test', 'unknown@example.test'] as $identifier) {
                $http->request('POST', '/api/password-recovery', ['identifier' => $identifier], ['X-CSRF-Token' => $csrf]);
                self::assertSame(503, $http->status);
                if ($body !== null) {
                    self::assertSame($body, $http->body);
                }
                $body = $http->body;
            }
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM password_reset_requests')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM recovery_deliveries')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM messenger_messages')));
        } finally {
            $http->close();
            $key === false ? putenv('RECOVERY_DELIVERY_KEY') : putenv('RECOVERY_DELIVERY_KEY='.$key);
        }
    }
}
