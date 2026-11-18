<?php

declare(strict_types=1);

namespace App\Tests\Functional\User;

use App\Domain\User\Role;
use App\Domain\User\User;
use App\Domain\User\UserProfile;
use App\Infrastructure\Security\SessionUser;
use PHPUnit\Framework\TestCase;

final class SessionContractTest extends TestCase
{
    public function testSerializedPrincipalContainsOnlyStableIdentity(): void
    {
        $principal = new SessionUser(new User(new UserProfile('Ana', null, 'ana@example.test', '+34600123456'), 'fixture-hash-not-for-login', [new Role(Role::USER)], 27));
        self::assertSame(['id' => 27], $principal->__serialize());
        self::assertSame([Role::USER], $principal->getRoles());
        $encoded = serialize($principal);
        self::assertFalse(str_contains($encoded, 'fixture-hash-not-for-login'));
        self::assertFalse(str_contains($encoded, 'ana@example.test'));
        $restored = unserialize($encoded, ['allowed_classes' => [SessionUser::class]]);
        self::assertInstanceOf(SessionUser::class, $restored);
        self::assertSame('27', $restored->getUserIdentifier());
    }
}
