<?php

declare(strict_types=1);

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

// Existing process test parameters take precedence over root development defaults.
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
if (($_SERVER['APP_ENV'] ?? null) !== 'test') {
    throw new LogicException('The test harness requires APP_ENV=test.');
}
$_SERVER['APP_DEBUG'] = '0';
$_SERVER['APP_CACHE_DIR'] = sys_get_temp_dir().'/tocaregalo-t5-phpunit-cache';
$_SERVER['KERNEL_CLASS'] = App\Kernel::class;

if (getenv('APP_ENV') === 'test' && getenv('RECOVERY_TEST_KEYS') === '1' && getenv('RECOVERY_TEST_KEY_READY') !== '1') {
    $recoveryFixtureKey = base64_encode(random_bytes(32));
    putenv('RECOVERY_DELIVERY_KEY='.$recoveryFixtureKey);
    $_ENV['RECOVERY_DELIVERY_KEY'] = $recoveryFixtureKey;
    $_SERVER['RECOVERY_DELIVERY_KEY'] = $recoveryFixtureKey;
    putenv('RECOVERY_TEST_KEY_READY=1');
    unset($recoveryFixtureKey);
}
