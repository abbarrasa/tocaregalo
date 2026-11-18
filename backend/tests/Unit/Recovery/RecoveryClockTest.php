<?php

declare(strict_types=1);

namespace App\Tests\Unit\Recovery;

use App\Application\Recovery\RecoveryLifetime;
use PHPUnit\Framework\TestCase;

final class RecoveryClockTest extends TestCase
{
    public function testConfiguredLifetimeUsesInstantAndRejectsNonpositiveValues(): void
    {
        $now = new \DateTimeImmutable('2026-11-18T12:00:00+00:00');
        self::assertSame(3600, (new RecoveryLifetime())->expires($now)->getTimestamp() - $now->getTimestamp());
        self::assertSame(90, (new RecoveryLifetime(90))->expires($now)->getTimestamp() - $now->getTimestamp());
        $this->expectException(\InvalidArgumentException::class);
        new RecoveryLifetime(0);
    }

    /** @return iterable<string, array{int|string}> */
    public static function invalidDurations(): iterable
    {
        foreach ([0, -1, 'abc', '1.5', '0', '999999999999999999999999'] as $index => $value) {
            yield (string) $index => [$value];
        }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('invalidDurations')]
    public function testInvalidConfigurationFailsClearly(int|string $duration): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('PASSWORD_RESET_TTL_SECONDS');
        new RecoveryLifetime($duration);
    }

    public function testBearerMaterialCannotBeSerializedOrDebugged(): void
    {
        $issued = new \App\Application\Recovery\IssuedRecovery('private-fixture-token', new \DateTimeImmutable());
        ob_start();
        var_dump($issued);
        $debug = ob_get_clean();
        self::assertIsString($debug);
        self::assertFalse(str_contains($debug, $issued->token));
        foreach ([static fn () => serialize($issued), static fn () => json_encode($issued, JSON_THROW_ON_ERROR)] as $operation) {
            try {
                $operation();
                self::fail('Bearer material serialized.');
            } catch (\LogicException $exception) {
                self::assertFalse(str_contains($exception->getMessage(), $issued->token));
            }
        }
    }
}
