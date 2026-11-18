<?php

declare(strict_types=1);

namespace App\Tests\Unit\User;

use App\Domain\User\PasswordPolicy;
use App\Domain\User\UserValues;
use App\Infrastructure\Validation\UserInputValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Validator\Validation;

final class UserValuesTest extends TestCase
{
    public function testTrimsAndNormalizesProfileWithoutFoldingAccents(): void
    {
        $profile = (new UserInputValidator(Validation::createValidator()))->validate('  Ana  ', '  Pérez  ', '  ANA@example.test  ', '+34 (600) 123-456');
        self::assertSame('Ana', $profile->firstName);
        self::assertSame('Pérez', $profile->lastName);
        self::assertSame('ANA@example.test', $profile->email);
        self::assertSame('ana@example.test', $profile->emailComparison);
        self::assertSame('+34600123456', $profile->phone);
        self::assertNull(UserValues::lastName('   '));
        self::assertNotSame(UserValues::emailComparison('ána@example.test'), $profile->emailComparison);
    }

    /** @return iterable<string, array{string, ?string, string, string}> */
    public static function invalidProfiles(): iterable
    {
        yield 'blank name' => [' ', null, 'ana@example.test', '+34600123456'];
        yield 'blank email' => ['Ana', null, '', '+34600123456'];
        yield 'invalid email' => ['Ana', null, 'invalid', '+34600123456'];
        yield 'missing prefix' => ['Ana', null, 'ana@example.test', '34600123456'];
        yield '00 prefix' => ['Ana', null, 'ana@example.test', '0034600123456'];
        yield 'no phone digits' => ['Ana', null, 'ana@example.test', '+'];
        yield 'blank phone' => ['Ana', null, 'ana@example.test', ' '];
        yield 'misplaced plus' => ['Ana', null, 'ana@example.test', '+34+600'];
        yield 'phone letters' => ['Ana', null, 'ana@example.test', '+34abc600'];
    }

    #[DataProvider('invalidProfiles')]
    public function testRejectsInvalidProfile(string $name, ?string $lastName, string $email, string $phone): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new UserInputValidator(Validation::createValidator()))->validate($name, $lastName, $email, $phone);
    }

    /** @return iterable<string, array{string}> */
    public static function acceptedPasswords(): iterable
    {
        foreach (['abcdef', '123456', '!@#$%^', 'ab12!?', ' áé🙂 x', '      ', str_repeat('á', 80)] as $index => $password) {
            yield 'variant '.$index => [$password];
        }
    }

    #[DataProvider('acceptedPasswords')]
    public function testAcceptsExactPasswordCharacters(#[\SensitiveParameter] string $password): void
    {
        self::assertSame($password, PasswordPolicy::validate($password));
    }

    public function testRejectsFiveUnicodeCharacters(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        PasswordPolicy::validate('áé🙂xy');
    }
}
