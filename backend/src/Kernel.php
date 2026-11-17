<?php

declare(strict_types=1);

namespace App;

use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

final class Kernel extends BaseKernel
{
    use MicroKernelTrait;

    public function __construct(string $environment, bool $debug)
    {
        /** @var string $timezone Configured through the environment. */
        $timezone = $_SERVER['APP_TIMEZONE'] ?? $_ENV['APP_TIMEZONE'] ?? 'UTC';
        date_default_timezone_set($timezone);
        parent::__construct($environment, $debug);
    }
}
