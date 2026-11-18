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

final class SuperAdminPersistenceTest extends KernelTestCase
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

    private function command(): \Symfony\Component\Console\Tester\CommandTester
    {
        return new \Symfony\Component\Console\Tester\CommandTester((new Application(self::$kernel ?? throw new \LogicException("Kernel missing.")))->find('app:user:create-super-admin'));
    }

    /** @return list<string> */
    private function inputs(string $email = 'ADMIN@example.test', string $phone = '+34 600-123-456', string $password = ' abcde'): array
    {
        return [$email, ' Ana ', '', $phone, $password, $password];
    }

    public function testCreatesMissingRoleAndReusesItWithoutOverwritingDuplicates(): void
    {
        $tester = $this->command();
        $tester->setInputs($this->inputs());
        self::assertSame(0, $tester->execute([], ['interactive' => true]));
        $row = $this->connection->fetchAssociative('SELECT first_name, last_name AS lastName, email_comparison, phone, password_hash FROM users');
        self::assertIsArray($row);
        self::assertSame('Ana', $row['first_name']);
        self::assertNull($row['lastName']);
        self::assertSame('admin@example.test', $row['email_comparison']);
        self::assertSame('+34600123456', $row['phone']);
        self::assertIsString($row['password_hash']);
        self::assertTrue((new SymfonyPasswordService())->verify($row['password_hash'], ' abcde'));
        self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles WHERE name = ?', [Role::SUPER_ADMIN])));
        self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM user_roles')));
        self::assertStringNotContainsString(' abcde', $tester->getDisplay());
        foreach ([$this->inputs('admin@example.test', '+12025550101'), $this->inputs('other@example.test', '+34600123456')] as $inputs) {
            $tester = $this->command(); $tester->setInputs($inputs);
            self::assertSame(1, $tester->execute([], ['interactive' => true]));
            self::assertTrue($row === $this->connection->fetchAssociative('SELECT first_name, last_name AS lastName, email_comparison, phone, password_hash FROM users'), "Existing account must remain unchanged.");
        }
        $tester = $this->command(); $tester->setInputs($this->inputs('second@example.test', '+12025550101', '123456'));
        self::assertSame(0, $tester->execute([], ['interactive' => true]));
        self::assertSame(1, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        self::assertSame(2, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM user_roles')));
    }

    public function testInvalidInputAndConfirmationNeverPersist(): void
    {
        foreach ([['invalid', 'invalid', 'invalid'], ['admin@example.test', ' ', ' ', ' '], ['admin@example.test','Ana','','0034600123456','bad','bad'], ['admin@example.test','Ana','','+34600123456','short','short','short'], ['admin@example.test','Ana','','+34600123456','abcdef','wrong','wrong','wrong'], []] as $inputs) {
            $tester = $this->command(); $tester->setInputs($inputs);
            self::assertNotSame(0, $tester->execute([], ['interactive' => true]));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
            self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        }
    }

    public function testRollbackRemovesNewRoleWhenInsertFails(): void
    {
        // MySQL's own column limit provides a deterministic failure after role persistence.
        $tester = $this->command();
        $inputs = $this->inputs(); $inputs[1] = str_repeat('a', 256);
        $tester->setInputs(array_values($inputs));
        self::assertSame(1, $tester->execute([], ['interactive' => true]));
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM users')));
        self::assertSame(0, self::integer($this->connection->fetchOne('SELECT COUNT(*) FROM roles')));
        self::assertStringNotContainsString('SQLSTATE', $tester->getDisplay());
    }
    public function testRealTerminalHidesAndPreservesPassword(): void
    {
        $password = " synthetic-terminal-secret ";
        $result = \App\Tests\Support\InteractiveTerminal::run([
            ["Correo electrónico", "tty@example.test"], ["Nombre", "Ana"], ["Apellidos", "Pérez"],
            ["Teléfono", "+34600123456"], ["Contraseña (", $password], ["Repite", $password],
        ]);
        self::assertSame(0, $result["exit"]);
        self::assertFalse(str_contains($result["output"], $password), "Password must not echo.");
        $hash = $this->connection->fetchOne("SELECT password_hash FROM users");
        self::assertIsString($hash);
        self::assertTrue((new SymfonyPasswordService())->verify($hash, $password));
        self::assertSame("Pérez", $this->connection->fetchOne("SELECT last_name FROM users"));
    }

    public function testByteBoundaryDoesNotCreateAnOversizedAccount(): void
    {
        $tooLong = str_repeat("á", 2048)."a";
        $tester = $this->command();
        $tester->setInputs(["large@example.test", "Ana", "", "+34600123456", $tooLong, $tooLong, $tooLong]);
        self::assertSame(1, $tester->execute([], ["interactive" => true]));
        self::assertSame(0, self::integer($this->connection->fetchOne("SELECT COUNT(*) FROM users")));
        $tester = $this->command(); $tester->setInputs($this->inputs("large@example.test", "+34600123456", str_repeat("á", 2048)));
        self::assertSame(0, $tester->execute([], ["interactive" => true]));
    }
}
