<?php

declare(strict_types=1);

use App\Kernel;

/** @var array<string, mixed> $runtimeOptions Application runtime options must be an array. */
$runtimeOptions = $_SERVER['APP_RUNTIME_OPTIONS'] ?? [];
$runtimeOptions['dotenv_path'] = '../.env';
$_SERVER['APP_RUNTIME_OPTIONS'] = $runtimeOptions;
require_once dirname(__DIR__).'/vendor/autoload_runtime.php';

return static function (array $context): Kernel {
    /** @var array{APP_ENV: string, APP_DEBUG: bool|string|int} $context Symfony Runtime environment context. */
    return new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
};
