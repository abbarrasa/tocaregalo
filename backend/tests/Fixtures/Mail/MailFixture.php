<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Mail;

use App\Tests\Support\TestDatabase;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Transport\SetupableTransportInterface;
use Symfony\Component\Messenger\Transport\TransportInterface;

final readonly class MailFixture
{
    public function __construct(private TransportInterface $transport, private MessageBusInterface $bus)
    {
    }

    public static function assertLocal(string $environment, #[\SensitiveParameter] string $dsn): void
    {
        if ($environment !== 'test' || $dsn !== 'smtp://tocaregalo-mailpit:1025') {
            throw new \LogicException('Mail fixtures require the isolated test environment and local SMTP capture.');
        }
    }

    public function prepareAndDispatch(FixtureMail $message): void
    {
        self::assertLocal(TestDatabase::environment('APP_ENV'), TestDatabase::environment('MAILER_DSN'));
        // Validate before any infrastructure DDL; this is only the isolated tmpfs test DB.
        $database = TestDatabase::fromEnvironment();
        try {
            if (!$this->transport instanceof SetupableTransportInterface) {
                throw new \LogicException('The fixture requires an explicitly setup-capable transport.');
            }
            $this->transport->setup();
            $this->bus->dispatch($message);
        } finally {
            $database->close();
        }
    }

    public function queuedCount(): int
    {
        $database = TestDatabase::fromEnvironment();
        try {
            $count = $database->connection()->fetchOne('SELECT COUNT(*) FROM messenger_messages WHERE queue_name = ?', ['notifications']);
            if (!is_int($count) && !is_string($count)) {
                throw new \RuntimeException('Invalid fixture queue count.');
            }

            return (int) $count;
        } finally {
            $database->close();
        }
    }

    /** @return array<array-key, mixed> */
    public function capturedMessage(string $marker): array
    {
        $deadline = microtime(true) + 5;
        do {
            $list = $this->captureJson('/api/v1/messages');
            $messages = $list['messages'] ?? [];
            if (!is_array($messages)) {
                throw new \RuntimeException('Invalid local capture response.');
            }
            foreach ($messages as $message) {
                if (is_array($message) && ($message['Subject'] ?? null) === 'Comprobación local '.$marker && is_string($message['ID'] ?? null)) {
                    return $this->captureJson('/api/v1/message/'.rawurlencode($message['ID']));
                }
            }
            usleep(50000);
        } while (microtime(true) < $deadline);
        throw new \RuntimeException('The expected fixture was not captured locally.');
    }

    /** @return array<array-key, mixed> */
    private function captureJson(string $path): array
    {
        $context = stream_context_create(['http' => ['timeout' => 3, 'follow_location' => 0]]);
        $body = @file_get_contents('http://tocaregalo-mailpit:8025'.$path, false, $context);
        if ($body === false) {
            throw new \RuntimeException('Local mail capture is unavailable.');
        }
        $result = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        if (!is_array($result)) {
            throw new \RuntimeException('Invalid local capture JSON.');
        }

        return $result;
    }
}
