<?php

declare(strict_types=1);

require dirname(__DIR__, 2).'/bootstrap.php';
$database = \App\Tests\Support\TestDatabase::fromEnvironment();
$kernel = new \App\Kernel('test', false);
try {
    $data = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($data) || !is_string($data['directory'] ?? null) || !is_string($data['token'] ?? null)) {
        throw new \RuntimeException('Invalid fixture input.');
    }
    $kernel->boot();
    $container = $kernel->getContainer()->get('test.service_container');
    if (!$container instanceof \Symfony\Component\DependencyInjection\ContainerInterface) {
        throw new \RuntimeException('Missing test services.');
    }
    $tokens = $container->get(\App\Application\Recovery\RecoveryTokens::class);
    if (!$tokens instanceof \App\Application\Recovery\RecoveryTokens) {
        throw new \RuntimeException('Missing lifecycle.');
    }
    $database->connection()->fetchOne('SELECT 1');
    touch($data['directory'].'/consumer');
    $tokens->reset($data['token'], ' concurrent reset ');
    echo 'consumed';
} catch (\Throwable) {
    fwrite(STDERR, 'Consume fixture failed.');
    exit(2);
} finally {
    $kernel->shutdown();
    $database->close();
}
