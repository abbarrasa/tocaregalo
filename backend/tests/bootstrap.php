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
