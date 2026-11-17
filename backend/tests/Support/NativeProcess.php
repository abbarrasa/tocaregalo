<?php

declare(strict_types=1);

namespace App\Tests\Support;

final class NativeProcess
{
    /** @param list<string> $arguments
     *  @return array{exit: int, output: string}
     */
    public static function run(array $arguments, int $timeout = 25): array
    {
        $output = tmpfile();
        if ($output === false) {
            throw new \RuntimeException('Cannot create process output fixture.');
        }
        $pipes = [];
        $process = proc_open($arguments, [0 => ['file', '/dev/null', 'r'], 1 => $output, 2 => $output], $pipes, dirname(__DIR__, 2));
        if (!is_resource($process)) {
            fclose($output);
            throw new \RuntimeException('Cannot start the fixture process.');
        }
        $deadline = microtime(true) + $timeout;
        do {
            $status = proc_get_status($process);
            if (!$status['running']) {
                break;
            }
            usleep(50000);
        } while (microtime(true) < $deadline);
        if ($status['running']) {
            proc_terminate($process, 9);
        }
        proc_close($process);
        rewind($output);
        $contents = stream_get_contents($output);
        fclose($output);
        if ($status['running']) {
            throw new \RuntimeException('Fixture process timed out.');
        }
        return ['exit' => $status['exitcode'], 'output' => $contents];
    }
}
