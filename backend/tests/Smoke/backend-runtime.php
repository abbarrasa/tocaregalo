<?php

declare(strict_types=1);

use App\Kernel;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require dirname(__DIR__, 2).'/vendor/autoload.php';

/** @var list<string> $argv CLI arguments supplied by PHP. */
$httpOnly = in_array('--http-only', $argv, true);
$kernel = null;
$stage = 'kernel availability';

try {
    if (!class_exists(Kernel::class)) {
        throw new RuntimeException('The backend kernel has not been implemented.');
    }

    $environmentFile = dirname(__DIR__, 3).'/.env';
    if (is_file($environmentFile)) {
        (new Dotenv())->bootEnv($environmentFile);
    }
    // This ephemeral value belongs only to the HTTP smoke process.
    $_SERVER['APP_SECRET'] ??= bin2hex(random_bytes(32));
    /** @var string $applicationSecret Dotenv strings or the generated process-local secret. */
    $applicationSecret = $_SERVER['APP_SECRET'];
    if ($httpOnly && !isset($_SERVER['DATABASE_URL']) && !isset($_ENV['DATABASE_URL'])) {
        // Non-routable fixture only: the HTTP check never opens this connection.
        $_SERVER['DATABASE_URL'] = 'mysql://unused:unused@no-database.invalid/unused?serverVersion=8.4.0';
    }
    $_SERVER['APP_CACHE_DIR'] = sys_get_temp_dir().'/tocaregalo-smoke-cache';
    $stage = 'kernel initialization';
    $kernel = new Kernel('test', false);
    $kernel->boot();

    foreach ([['/api', 200], ['/api/unknown-smoke-path', 404], ['/api/docs', 404]] as [$path, $status]) {
        foreach (['application/json', 'text/html'] as $accept) {
            $stage = 'HTTP '.$path.' ('.$accept.')';
            $request = Request::create($path, 'GET', server: ['HTTP_ACCEPT' => $accept]);
            $response = $kernel->handle($request);
            $type = $response->headers->get('Content-Type', '');
            $stage .= ' status='.$response->getStatusCode().' content-type='.$type;
            if ($response->getStatusCode() !== $status || !str_contains($type, 'json')) {
                throw new RuntimeException('The API response status or JSON content type is incorrect.');
            }
            $body = (string) $response->getContent();
            json_decode($body, true, flags: JSON_THROW_ON_ERROR);
            if (str_contains($body, '<html') || str_contains($body, 'trace') || str_contains($body, $applicationSecret)) {
                throw new RuntimeException('The API response exposes HTML or private diagnostic information.');
            }
            $kernel->terminate($request, $response);
        }
    }
    fwrite(STDOUT, "HTTP JSON smoke checks passed.\n");

    if (!$httpOnly) {
        $stage = 'MySQL connection and queries';
        /** @var ManagerRegistry $registry The public doctrine service registered by DoctrineBundle. */
        $registry = $kernel->getContainer()->get('doctrine');
        /** @var Connection $connection DoctrineBundle uses DBAL for the configured MySQL connection. */
        $connection = $registry->getConnection();
        /** @var int|string $probe MySQL SELECT 1 returns an integer or its string representation. */
        $probe = $connection->fetchOne('SELECT 1');
        /** @var string $version MySQL VERSION() returns a string. */
        $version = $connection->fetchOne('SELECT VERSION()');
        if ((int) $probe !== 1
            || !str_starts_with($version, '8.4.')
            || $connection->fetchOne('SELECT @@session.time_zone') !== '+00:00') {
            throw new RuntimeException('The MySQL version, query or timezone check failed.');
        }
        $connection->close();
        fwrite(STDOUT, "MySQL 8.4 query and UTC session checks passed.\n");
    }
} catch (Throwable $exception) {
    // Do not print exception messages that could contain a database DSN or secret.
    fwrite(STDERR, 'Runtime smoke failed at '.$stage.' ('.$exception::class.").\n");
    exit(1);
} finally {
    $kernel?->shutdown();
}
