<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Tests\Support\TestDatabase;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;

final class DatabaseBoundaryTest extends TestCase
{
    public function testFixtureRollsBackWhenTheCallbackFails(): void
    {
        $database = TestDatabase::fromEnvironment();
        try {
            try {
                $database->withFixture(static function (Connection $connection): void {
                    $connection->executeStatement('INSERT INTO tocaregalo_harness_fixture (id, value) VALUES (?, ?)', [2, 'failure fixture']);
                    throw new \RuntimeException('Expected fixture callback failure.');
                });
                self::fail('The callback failure must propagate.');
            } catch (\RuntimeException $exception) {
                self::assertSame('Expected fixture callback failure.', $exception->getMessage());
            }
            self::assertContains($database->connection()->fetchOne('SELECT COUNT(*) FROM tocaregalo_harness_fixture'), [0, '0']);
        } finally {
            $database->close();
        }
    }

    public function testRealMysqlFixtureIsRolledBackAndCanBeReused(): void
    {
        $database = TestDatabase::fromEnvironment();
        try {
            $connection = $database->connection();
            $version = $connection->fetchOne('SELECT VERSION()');
            self::assertIsString($version);
            self::assertStringStartsWith('8.4.', $version);
            self::assertSame('+00:00', $connection->fetchOne('SELECT @@session.time_zone'));
            self::assertSame(TestDatabase::environment('TEST_MYSQL_DATABASE'), $connection->fetchOne('SELECT DATABASE()'));
            $database->withFixture(static function (Connection $connection): void {
                $value = "fixture ' bound value";
                $connection->executeStatement('INSERT INTO tocaregalo_harness_fixture (id, value) VALUES (?, ?)', [1, $value]);
                self::assertSame($value, $connection->fetchOne('SELECT value FROM tocaregalo_harness_fixture WHERE id = ?', [1]));
            });
            self::assertContains($connection->fetchOne('SELECT COUNT(*) FROM tocaregalo_harness_fixture'), [0, '0']);
            $database->withFixture(static function (Connection $connection): void {
                self::assertContains($connection->fetchOne('SELECT COUNT(*) FROM tocaregalo_harness_fixture'), [0, '0']);
            });
        } finally {
            $database->close();
        }
    }
}
