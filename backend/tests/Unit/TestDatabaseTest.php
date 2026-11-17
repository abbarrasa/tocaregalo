<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Tests\Support\TestDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class TestDatabaseTest extends TestCase
{
    /** @return iterable<string, array{string, string, string, string, string}> */
    public static function unsafeTargets(): iterable
    {
        $url = 'mysql://fixture:fixture@tocaregalo-mysql:3306/tocaregalo_test';
        yield 'development environment' => ['dev', $url, $url, 'tocaregalo_test', 'tocaregalo'];
        yield 'development database' => ['test', $url, $url, 'tocaregalo_test', 'tocaregalo_test'];
        yield 'mismatched declaration' => ['test', $url, $url.'?charset=utf8mb4', 'tocaregalo_test', 'tocaregalo'];
        yield 'wrong schema' => ['test', $url, $url, 'other_test', 'tocaregalo'];
        yield 'missing schema' => ['test', $url, $url, '', 'tocaregalo'];
        yield 'unknown development schema' => ['test', $url, $url, 'tocaregalo_test', ''];
        yield 'external host' => ['test', str_replace('tocaregalo-mysql', 'external.invalid', $url), str_replace('tocaregalo-mysql', 'external.invalid', $url), 'tocaregalo_test', 'tocaregalo'];
        yield 'wrong driver' => ['test', str_replace('mysql:', 'sqlite:', $url), str_replace('mysql:', 'sqlite:', $url), 'tocaregalo_test', 'tocaregalo'];
        yield 'wrong port' => ['test', str_replace(':3306', ':3307', $url), str_replace(':3306', ':3307', $url), 'tocaregalo_test', 'tocaregalo'];
        yield 'socket override' => ['test', $url.'?unix_socket=/unsafe.sock', $url.'?unix_socket=/unsafe.sock', 'tocaregalo_test', 'tocaregalo'];
        yield 'query overrides schema' => ['test', $url.'?dbname=tocaregalo', $url.'?dbname=tocaregalo', 'tocaregalo_test', 'tocaregalo'];
    }

    #[DataProvider('unsafeTargets')]
    public function testUnsafeTargetsAreRejectedBeforeConnection(string $environment, string $url, string $declared, string $testName, string $developmentName): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Refusing an unsafe test database target.');
        TestDatabase::assertTarget($environment, $url, $declared, $testName, $developmentName);
    }

    public function testTheExplicitIsolatedTargetIsAccepted(): void
    {
        $url = 'mysql://fixture:fixture@tocaregalo-mysql:3306/tocaregalo_test';
        TestDatabase::assertTarget('test', $url, $url, 'tocaregalo_test', 'tocaregalo');
        $this->addToAssertionCount(1);
    }
}
