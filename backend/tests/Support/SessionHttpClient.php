<?php

declare(strict_types=1);

namespace App\Tests\Support;

final class SessionHttpClient
{
    /** @var resource|null */
    private $process = null;
    /** @var resource|null */
    private $log = null;
    private string $base;
    public string $cookie = '';
    /** @var list<string> */
    public array $headers = [];
    public int $status = 0;
    public string $body = '';

    public function __construct()
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $error, $message);
        if ($socket === false) {
            throw new \RuntimeException('Cannot reserve loopback HTTP fixture.');
        }
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        if (!is_string($address)) {
            throw new \RuntimeException('Missing HTTP fixture address.');
        }
        $this->base = 'http://'.$address;
        $this->log = tmpfile();
        if ($this->log === false) {
            throw new \RuntimeException('Cannot open private HTTP fixture log.');
        }
        $pipes = [];
        $process = proc_open([PHP_BINARY, '-S', $address, 'tests/Fixtures/Http/router.php'], [0 => ['file', '/dev/null', 'r'], 1 => $this->log, 2 => $this->log], $pipes, dirname(__DIR__, 2));
        if (!is_resource($process)) {
            throw new \RuntimeException('Cannot start HTTP fixture.');
        }
        $this->process = $process;
        $deadline = microtime(true) + 20;
        do {
            $ready = @stream_socket_client('tcp://'.$address, $error, $message, 0.2);
            if (is_resource($ready)) {
                fclose($ready);
                return;
            }
            usleep(50000);
        } while (microtime(true) < $deadline);
        $this->close();
        throw new \RuntimeException('HTTP fixture did not become ready.');
    }

    /** @param array<string, mixed>|null $data
     *  @param array<string, string> $headers
     */
    public function request(string $method, string $path, ?array $data = null, array $headers = []): void
    {
        $headers = $headers + ['Accept' => 'application/json', 'Content-Type' => 'application/json', 'Connection' => 'close', 'Cookie' => $this->cookie];
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = $name.': '.$value;
        }
        $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $lines), 'content' => $data === null ? '' : json_encode($data, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 20]]);
        $body = file_get_contents($this->base.$path, false, $context);
        $this->headers = http_get_last_response_headers() ?? [];
        if ($body === false) {
            throw new \RuntimeException('HTTP fixture request failed.');
        }
        $this->body = $body;
        $this->status = isset($this->headers[0]) && preg_match('/HTTP\/\S+ (\d+)/', $this->headers[0], $match) === 1 ? (int) $match[1] : 0;
        foreach ($this->headers as $header) {
            if (preg_match('/^Set-Cookie: (TOCAREGALO_SESSION=[^;]*)/i', $header, $match) === 1) {
                $this->cookie = $match[1];
            }
        }
    }

    /** @return array<array-key, mixed> */
    public function json(): array
    {
        $value = json_decode($this->body, true, flags: JSON_THROW_ON_ERROR);
        if (!is_array($value) || array_is_list($value)) {
            throw new \RuntimeException('Expected JSON object.');
        }
        return $value;
    }

    public function csrf(): string
    {
        $this->request('GET', '/api/csrf');
        $token = $this->json()['csrfToken'] ?? null;
        if (!is_string($token)) {
            throw new \RuntimeException('Missing CSRF fixture token.');
        }
        return $token;
    }

    public function logsContain(string $value): bool
    {
        if (!is_resource($this->log)) {
            throw new \LogicException('HTTP fixture log is closed.');
        }
        rewind($this->log);
        $contents = stream_get_contents($this->log);
        return is_string($contents) && str_contains($contents, $value);
    }

    public function close(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
            $this->process = null;
        }
        if (is_resource($this->log)) {
            fclose($this->log);
            $this->log = null;
        }
    }
}
