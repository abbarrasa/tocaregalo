<?php

declare(strict_types=1);

namespace App\Tests\Support;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Tools\DsnParser;
use LogicException;
use RuntimeException;
use Throwable;

final class TestDatabase
{
    private function __construct(private readonly Connection $connection)
    {
    }

    public static function environment(string $name): string
    {
        $value = $_SERVER[$name] ?? $_ENV[$name] ?? getenv($name);
        if (!is_string($value) || $value === '') {
            throw new LogicException('Missing test environment parameter: '.$name);
        }

        return $value;
    }

    public static function assertTarget(string $environment, #[\SensitiveParameter] string $url, #[\SensitiveParameter] string $declaredUrl, string $testName, string $developmentName): void
    {
        try {
            $params = (new DsnParser(['mysql' => 'pdo_mysql']))->parse($url);
        } catch (Throwable) {
            throw new LogicException('Refusing an unsafe test database target.');
        }
        if ($environment !== 'test' || $url !== $declaredUrl || $developmentName === ''
            || array_diff(array_keys($params), ['driver', 'host', 'port', 'dbname', 'user', 'password', 'charset', 'serverVersion']) !== []
            || $testName === $developmentName || !str_ends_with($testName, '_test')
            || ($params['driver'] ?? null) !== 'pdo_mysql'
            || ($params['host'] ?? null) !== 'tocaregalo-mysql'
            || (int) ($params['port'] ?? 3306) !== 3306
            || ($params['dbname'] ?? null) !== $testName) {
            throw new LogicException('Refusing an unsafe test database target.');
        }
    }

    public static function fromEnvironment(): self
    {
        $url = self::environment('DATABASE_URL');
        self::assertTarget(self::environment('APP_ENV'), $url, self::environment('TEST_DATABASE_URL'), self::environment('TEST_MYSQL_DATABASE'), self::environment('MYSQL_DATABASE'));
        $params = (new DsnParser(['mysql' => 'pdo_mysql']))->parse($url);
        $params['driverOptions'] = [1002 => "SET time_zone = '+00:00'"];
        try {
            $connection = DriverManager::getConnection($params);
            $connection->executeQuery('SELECT 1');
        } catch (Throwable) {
            throw new RuntimeException('Could not connect to the isolated test database.');
        }

        return new self($connection);
    }

    public function connection(): Connection
    {
        return $this->connection;
    }

    /** @param callable(Connection): void $test */
    public function withFixture(callable $test): void
    {
        $this->connection->executeStatement('CREATE TEMPORARY TABLE IF NOT EXISTS tocaregalo_harness_fixture (id INT PRIMARY KEY, value VARCHAR(255) NOT NULL) ENGINE=InnoDB');
        $this->connection->beginTransaction();
        try {
            $test($this->connection);
        } finally {
            $this->connection->rollBack();
        }
    }

    public function close(): void
    {
        $this->connection->close();
    }
}
