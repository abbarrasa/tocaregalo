<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use App\Application\Port\Clock;
use App\Application\Port\RecoveryDelivery;
use App\Application\Recovery\IssuedRecovery;
use Doctrine\DBAL\Connection;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Mime\Email;

final readonly class RecoveryDeliveryStore implements RecoveryDelivery
{
    public function __construct(private Connection $connection, private MessageBusInterface $bus, private RecoveryEnvelope $cipher, private RecoveryLink $links, private Clock $clock, private MailerInterface $mailer)
    {
    }

    public function validate(): void
    {
        $this->cipher->validate();
        $this->links->validate();
    }

    public function enqueue(int $userId, int $requestId, #[\SensitiveParameter] IssuedRecovery $issued): void
    {
        if (!$this->connection->isTransactionActive()) {
            throw new DeliveryUnavailable();
        }
        $this->validate();
        $messageId = bin2hex(random_bytes(16)).'@tocaregalo.invalid';
        $this->connection->insert('recovery_deliveries', ['user_id' => $userId, 'request_id' => $requestId, 'message_id' => $messageId]);
        $id = (int) $this->connection->lastInsertId();
        $this->connection->update('recovery_deliveries', $this->cipher->seal($issued->token, $requestId, $id), ['id' => $id]);
        $this->bus->dispatch(new RecoveryMail($id));
    }

    public function deliver(int $id): void
    {
        try {
            $this->connection->transactional(function (Connection $db) use ($id): void {
                $row = $this->locked($id);
                if ($row === null || !in_array($row['state'], ['pending', 'retrying'], true)) {
                    return;
                }
                if ($row['consumed_at'] !== null || $row['superseded_at'] !== null || $this->clock->now() >= new \DateTimeImmutable(self::text($row['expires_at']), new \DateTimeZone('UTC'))) {
                    $this->terminal($id, 'cancelled', 'stale');
                    return;
                }
                try {
                    $token = $this->cipher->open(['version' => self::integer($row['version']), 'ciphertext' => self::text($row['ciphertext']), 'nonce' => self::text($row['nonce'])], self::integer($row['request_id']), $id);
                    $link = $this->links->url($token);
                } catch (\Throwable) {
                    $this->terminal($id, 'failed', 'protected_data');
                    return;
                }
                $email = (new Email())->to(self::text($row['email']))->subject('Recupera tu contraseña de Toca Regalo')
                    ->text("Puedes restablecer tu contraseña de Toca Regalo con este enlace:\n".$link."\n\nEl enlace es de un solo uso y caduca el ".self::text($row['expires_at'])." UTC. Si no lo has solicitado, ignora este mensaje.");
                $email->getHeaders()->addIdHeader('Message-ID', self::text($row['message_id']));
                // The account lock serializes reset/supersession and duplicate handoffs.
                $this->mailer->send($email);
                $db->executeStatement('UPDATE recovery_deliveries SET attempts = attempts + 1 WHERE id = ?', [$id]);
                $this->terminal($id, 'sent', 'accepted');
            });
        } catch (\Throwable) {
            // Never chain transport exceptions: they can retain the rendered bearer link.
            throw new DeliveryUnavailable();
        }
    }

    /** @return array<string, mixed>|null */
    private function locked(int $id): ?array
    {
        $db = $this->connection;
        $owner = $db->fetchAssociative('SELECT user_id, request_id FROM recovery_deliveries WHERE id = ?', [$id]);
        if ($owner === false || $db->fetchOne('SELECT id FROM users WHERE id = ? FOR UPDATE', [$owner['user_id']]) === false) {
            return null;
        }
        if ($db->fetchOne('SELECT id FROM password_reset_requests WHERE id = ? FOR UPDATE', [$owner['request_id']]) === false) {
            return null;
        }
        return $db->fetchAssociative('SELECT d.*, r.expires_at, r.consumed_at, r.superseded_at, u.email FROM recovery_deliveries d JOIN password_reset_requests r ON r.id = d.request_id JOIN users u ON u.id = d.user_id WHERE d.id = ? FOR UPDATE', [$id]) ?: null;
    }

    public function retry(int $id, int $count, ?\DateTimeImmutable $due): void
    {
        $this->connection->transactional(function (Connection $db) use ($id, $count, $due): void {
            $row = $this->locked($id);
            if ($row === null || !in_array($row['state'], ['pending', 'retrying'], true) || self::integer($row['retry_count']) > $count) {
                return;
            }
            $db->update('recovery_deliveries', ['attempts' => $count, 'retry_count' => $count, 'next_due_at' => $due?->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u'), 'state' => 'retrying', 'status_code' => 'transport_failure'], ['id' => $id]);
        });
    }

    public function failed(int $id): void
    {
        $this->connection->transactional(function (Connection $db) use ($id): void {
            $row = $this->locked($id);
            if ($row !== null && in_array($row['state'], ['pending', 'retrying'], true)) {
                $db->executeStatement('UPDATE recovery_deliveries SET attempts = attempts + 1 WHERE id = ?', [$id]);
                $this->terminal($id, 'failed', 'retries_exhausted');
            }
        });
    }

    public function cleanup(): void
    {
        if (!$this->connection->createSchemaManager()->tablesExist(["recovery_deliveries"])) {
            return;
        }
        // Bound each cycle; account-first locks match all other lifecycle operations.
        $ids = $this->connection->fetchFirstColumn("SELECT d.id FROM recovery_deliveries d JOIN password_reset_requests r ON r.id = d.request_id WHERE d.state IN ('pending', 'retrying') AND (r.expires_at <= ? OR r.consumed_at IS NOT NULL OR r.superseded_at IS NOT NULL) ORDER BY d.id LIMIT 50", [$this->clock->now()->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u')]);
        foreach ($ids as $id) {
            if (is_int($id) || is_string($id)) {
                $this->connection->transactional(function () use ($id): void {
                    $row = $this->locked((int) $id);
                    if ($row !== null && in_array($row['state'], ['pending', 'retrying'], true) && ($row['consumed_at'] !== null || $row['superseded_at'] !== null || $this->clock->now() >= new \DateTimeImmutable(self::text($row['expires_at']), new \DateTimeZone('UTC')))) {
                        $this->terminal((int) $id, 'cancelled', 'stale');
                    }
                });
            }
        }
    }

    private function terminal(int $id, string $state, string $code): void
    {
        $this->connection->update('recovery_deliveries', ['state' => $state, 'status_code' => $code, 'ciphertext' => null, 'nonce' => null, 'next_due_at' => null], ['id' => $id]);
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? $value : throw new DeliveryUnavailable();
    }

    private static function integer(mixed $value): int
    {
        return is_int($value) || is_string($value) ? (int) $value : throw new DeliveryUnavailable();
    }
}
