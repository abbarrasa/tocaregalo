<?php

declare(strict_types=1);

$directory = $argv[1] ?? throw new \RuntimeException('Missing fixture directory.');
$server = stream_socket_server('tcp://127.0.0.1:0');
if ($server === false) {
    exit(2);
}
$address = stream_socket_get_name($server, false);
if (!is_string($address)) {
    exit(2);
}
file_put_contents($directory.'/address', $address);
$client = stream_socket_accept($server, 25);
if ($client === false) {
    fclose($server);
    exit(2);
}
stream_set_timeout($client, 25);
fwrite($client, "220 localhost fixture\r\n");
try {
    while (($line = fgets($client)) !== false) {
        if (str_starts_with($line, 'EHLO') || str_starts_with($line, 'HELO')) {
            fwrite($client, "250 localhost\r\n");
        } elseif (str_starts_with($line, 'DATA')) {
            fwrite($client, "354 Continue\r\n");
            while (($data = fgets($client)) !== false && $data !== ".\r\n") {
                // Deliberately discard bearer-bearing SMTP data without logging it.
            }
            touch($directory.'/ready');
            $deadline = microtime(true) + 25;
            while (!is_file($directory.'/go')) {
                if (microtime(true) > $deadline) {
                    throw new \RuntimeException('Barrier timeout.');
                }
                usleep(10000);
            }
            fwrite($client, "250 Accepted\r\n");
        } elseif (str_starts_with($line, 'QUIT')) {
            fwrite($client, "221 Bye\r\n");
            break;
        } else {
            fwrite($client, "250 OK\r\n");
        }
    }
} finally {
    fclose($client);
    fclose($server);
}
