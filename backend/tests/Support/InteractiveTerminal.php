<?php

declare(strict_types=1);

namespace App\Tests\Support;

final class InteractiveTerminal
{
    /** @param list<array{string, string}> $answers
     *  @return array{exit: int, output: string}
     */
    public static function run(array $answers): array
    {
        $pipes = [];
        $process = proc_open([PHP_BINARY, 'bin/console', '--env=test', '--no-debug', 'app:user:create-super-admin'], [0 => ['pty'], 1 => ['pty'], 2 => ['pty']], $pipes, dirname(__DIR__, 2));
        if (!is_resource($process)) {
            throw new \RuntimeException('Cannot open the test pseudo-terminal.');
        }
        foreach ($pipes as $pipe) {
            stream_set_blocking($pipe, false);
        }
        $output = ''; $next = 0; $deadline = microtime(true) + 60;
        $exit = -1;
        try {
            do {
                foreach ($pipes as $pipe) {
                    // Linux PTYs report EIO when their slave closes normally.
                    // Handle only that terminal EOF; other notices remain visible.
                    set_error_handler(static fn (int $severity, string $message): bool => str_contains($message, 'errno=5'));
                    try {
                        $chunk = stream_get_contents($pipe);
                    } finally {
                        restore_error_handler();
                    }
                    if ($chunk !== false) {
                        $output .= $chunk;
                    }
                }
                if (isset($answers[$next]) && str_contains($output, $answers[$next][0])) {
                    // Allow the question helper to switch echo off after printing the prompt.
                    usleep(300000);
                    fwrite($pipes[0], $answers[$next][1]."\n");
                    ++$next;
                }
                $status = proc_get_status($process);
                if (!$status['running']) {
                    $exit = $status['exitcode'];
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            if ($exit === -1) {
                proc_terminate($process, 9);
                throw new \RuntimeException('Terminal fixture did not finish within its limit.');
            }
        } finally {
            foreach ($pipes as $pipe) {
                fclose($pipe);
            }
            proc_close($process);
        }
        return ['exit' => $exit, 'output' => $output];
    }
}
