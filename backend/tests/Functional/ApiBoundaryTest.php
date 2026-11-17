<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ApiBoundaryTest extends WebTestCase
{
    /** @return iterable<string, array{string, int, string}> */
    public static function apiRequests(): iterable
    {
        foreach (['application/json', 'text/html'] as $accept) {
            foreach (['/api' => 200, '/api/not-found-harness' => 404, '/api/docs' => 404] as $path => $status) {
                yield $path.' '.$accept => [$path, $status, $accept];
            }
        }
    }

    #[DataProvider('apiRequests')]
    public function testJsonBoundary(string $path, int $status, string $accept): void
    {
        $client = static::createClient(['environment' => 'test', 'debug' => false]);
        $client->request('GET', $path, server: ['HTTP_ACCEPT' => $accept]);
        $response = $client->getResponse();
        self::assertSame($status, $response->getStatusCode());
        self::assertStringContainsString('json', $response->headers->get('Content-Type') ?? '');
        $body = (string) $response->getContent();
        self::assertIsArray(json_decode($body, true, flags: JSON_THROW_ON_ERROR));
        self::assertStringNotContainsString('<html', $body);
        self::assertStringNotContainsString('trace', $body);
        self::assertStringNotContainsString(\App\Tests\Support\TestDatabase::environment('APP_SECRET'), $body);
    }
}
