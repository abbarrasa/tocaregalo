<?php

declare(strict_types=1);

use App\Application\Recovery\InvalidRecoveryToken;
use App\Application\Recovery\RecoveryLifetime;
use App\Application\Recovery\RecoveryTokens;
use App\Infrastructure\Doctrine\DoctrineRecoveryStore;
use App\Infrastructure\Security\SymfonyPasswordService;
use App\Tests\Support\TestDatabase;

require dirname(__DIR__, 2).'/bootstrap.php';

$database = TestDatabase::fromEnvironment();
try {
    $input = stream_get_contents(STDIN);
    $data = json_decode($input, true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($data) || !is_string($data['directory'] ?? null) || !is_string($data['operation'] ?? null) || !is_int($data['userId'] ?? null) || !is_string($data['token'] ?? null) || !is_bool($data['hold'] ?? null)) {
        throw new \RuntimeException('Invalid fixture input.');
    }
    $directory = $data['directory'];
    $hold = $data['hold'];
    $clock = new class($directory, $hold) implements \App\Application\Port\Clock {
        public function __construct(private string $directory, private bool $hold)
        {
        }
        public function now(): \DateTimeImmutable
        {
            if ($this->hold) {
                touch($this->directory.'/ready');
                $deadline = microtime(true) + 30;
                while (!is_file($this->directory.'/go')) {
                    if (microtime(true) > $deadline) {
                        throw new \RuntimeException('Fixture barrier timeout.');
                    }
                    usleep(10000);
                }
            }
            return new \DateTimeImmutable('2026-11-18T12:00:00Z');
        }
    };
    $service = new RecoveryTokens(new DoctrineRecoveryStore($database->connection()), new SymfonyPasswordService(), $clock, new RecoveryLifetime());
    $database->connection()->fetchOne("SELECT 1");
    if (!$hold) {
        touch($directory.'/started');
    }
    try {
        if ($data['operation'] === 'issue') {
            $service->issue($data['userId']);
        } else {
            $service->reset($data['token'], ' concurrent password ');
        }
        echo 'success';
    } catch (InvalidRecoveryToken) {
        echo 'inactive';
    }
} catch (\Throwable) {
    fwrite(STDERR, 'Recovery race fixture failed.');
    exit(2);
} finally {
    $database->close();
}
