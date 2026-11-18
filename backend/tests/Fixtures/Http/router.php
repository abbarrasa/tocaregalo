<?php

declare(strict_types=1);

// Only the isolated loopback fixture enables simulated HTTPS cookie checks.
if (getenv('APP_ENV') !== 'test') {
    http_response_code(500);
    exit;
}
if (($_SERVER['HTTP_X_FIXTURE_HTTPS'] ?? '') === '1') {
    $_SERVER['HTTPS'] = 'on';
    $_SERVER['SERVER_PORT'] = '443';
}
$_SERVER['SCRIPT_FILENAME'] = dirname(__DIR__, 3).'/public/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';
require $_SERVER['SCRIPT_FILENAME'];
