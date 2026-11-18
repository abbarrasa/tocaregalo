<?php

declare(strict_types=1);

namespace App\Tests\Unit\Recovery;

use App\Infrastructure\Mail\RecoveryEnvelope;
use PHPUnit\Framework\TestCase;

final class DeliveryProtectionTest extends TestCase
{
    public function testAuthenticatedEnvelopeIsBoundAndUsesFreshNonces(): void
    {
        $key = base64_encode(random_bytes(32));
        $cipher = new RecoveryEnvelope($key);
        $first = $cipher->seal('private-token', 1, 2);
        $second = $cipher->seal('private-token', 1, 2);
        self::assertTrue($first['nonce'] !== $second['nonce']);
        self::assertSame('private-token', $cipher->open($first, 1, 2));
        foreach ([static fn () => $cipher->open($first, 2, 2), static fn () => (new RecoveryEnvelope(base64_encode(random_bytes(32))))->open($first, 1, 2), static fn () => $cipher->open(array_replace($first, ['ciphertext' => 'broken']), 1, 2)] as $operation) {
            try {
                $operation();
                self::fail('Untrusted envelope accepted.');
            } catch (\App\Infrastructure\Mail\DeliveryUnavailable $exception) {
                self::assertFalse(str_contains($exception->getMessage(), 'private-token'));
            }
        }
    }

    public function testMissingKeyFailsClosed(): void
    {
        $this->expectException(\App\Infrastructure\Mail\DeliveryUnavailable::class);
        (new RecoveryEnvelope(''))->validate();
    }

    public function testStrictKeyAndTrustedUrlConfiguration(): void
    {
        foreach (['', 'not-base64', base64_encode(random_bytes(31)), base64_encode(random_bytes(33))] as $key) {
            try {
                (new RecoveryEnvelope($key))->validate();
                self::fail('Invalid key accepted.');
            } catch (\App\Infrastructure\Mail\DeliveryUnavailable) {
                self::addToAssertionCount(1);
            }
        }
        self::assertSame('http://localhost:8080/password-reset#token=private', (new \App\Infrastructure\Mail\RecoveryLink('http://localhost:8080', 'test'))->url('private'));
        foreach (['http://localhost', 'https://user:password@example.test', 'https://example.test?url=other', 'https://example.test#fragment', 'file:///tmp/url', "https://example.test/\r\n"] as $url) {
            try {
                (new \App\Infrastructure\Mail\RecoveryLink($url, 'prod'))->validate();
                self::fail('Untrusted URL accepted.');
            } catch (\App\Infrastructure\Mail\DeliveryUnavailable) {
                self::addToAssertionCount(1);
            }
        }
    }
}
