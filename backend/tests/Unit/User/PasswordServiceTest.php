<?php

declare(strict_types=1);

namespace App\Tests\Unit\User;

use App\Infrastructure\Security\SymfonyPasswordService;
use PHPUnit\Framework\TestCase;

final class PasswordServiceTest extends TestCase
{
    public function testSymfonyHashesAndVerifiesWithoutTrimmingOrTruncating(): void
    {
        $service = new SymfonyPasswordService();
        foreach (['abcdef', '123456', '!@#$%^', ' áé🙂 x', '      ', str_repeat('á', 80)] as $password) {
            $hash = $service->hash($password);
            self::assertNotSame($password, $hash);
            self::assertTrue($service->verify($hash, $password));
            self::assertFalse($service->verify($hash, $password.'x'));
        }
        $hash = $service->hash(' abcde');
        self::assertFalse($service->verify($hash, 'abcde'));
    }
}
