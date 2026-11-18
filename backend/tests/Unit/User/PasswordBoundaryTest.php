<?php

declare(strict_types=1);

namespace App\Tests\Unit\User;

use App\Domain\User\PasswordPolicy;
use App\Infrastructure\Security\SymfonyPasswordService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PasswordBoundaryTest extends TestCase
{
    /** @return iterable<string, array{string}> */
    public static function boundaryPasswords(): iterable
    {
        yield 'ASCII with whitespace' => [' '.str_repeat('a', 4094).' '];
        yield 'multibyte with whitespace' => [' '.str_repeat('á', 2047).' '];
    }

    #[DataProvider('boundaryPasswords')]
    public function testPolicyPreserves4096Bytes(#[\SensitiveParameter] string $password): void
    {
        self::assertSame(4096, strlen($password));
        self::assertSame($password, PasswordPolicy::validate($password));
    }

    #[DataProvider('boundaryPasswords')]
    public function testPolicyRejects4097Bytes(#[\SensitiveParameter] string $password): void
    {
        $this->expectException(\InvalidArgumentException::class);
        PasswordPolicy::validate($password.'a');
    }

    #[DataProvider('boundaryPasswords')]
    public function testSymfonyVerifies4096BytesExactly(#[\SensitiveParameter] string $password): void
    {
        $service = new SymfonyPasswordService();
        $hash = $service->hash($password);
        self::assertNotSame($password, $hash);
        self::assertTrue($service->verify($hash, $password));
        self::assertFalse($service->verify($hash, 'x'.substr($password, 1)));
        self::assertFalse($service->verify($hash, trim($password)));
    }

    #[DataProvider('boundaryPasswords')]
    public function testHashBoundaryRejects4097BytesBeforeSymfony(#[\SensitiveParameter] string $password): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new SymfonyPasswordService())->hash($password.'a');
    }
}
