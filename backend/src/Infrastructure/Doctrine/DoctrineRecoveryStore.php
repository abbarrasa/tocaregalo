<?php

declare(strict_types=1);

namespace App\Infrastructure\Doctrine;

use App\Application\Port\RecoveryStore;
use App\Application\Recovery\InvalidRecoveryToken;
use Doctrine\DBAL\Connection;

final readonly class DoctrineRecoveryStore implements RecoveryStore
{
    public function __construct(private Connection $connection)
    {
    }

    public function issue(int $userId, callable $issue, ?callable $handoff = null): void
    {
        $this->connection->transactional(function (Connection $db) use ($userId, $issue, $handoff): void {
            self::lockUser($db, $userId);
            $values = $issue();
            $db->executeStatement('UPDATE password_reset_requests SET superseded_at = ? WHERE user_id = ? AND superseded_at IS NULL', [self::format($values['issued']), $userId]);
            $db->executeStatement("UPDATE recovery_deliveries SET state = 'cancelled', ciphertext = NULL, nonce = NULL, next_due_at = NULL WHERE user_id = ? AND state IN ('pending', 'retrying')", [$userId]);
            $db->insert('password_reset_requests', ['user_id' => $userId, 'token_hash' => $values['hash'], 'issued_at' => self::format($values['issued']), 'expires_at' => self::format($values['expires'])]);
            if ($handoff !== null) {
                $handoff((int) $db->lastInsertId());
            }
        });
    }

    public function consume(string $digest, callable $consume): void
    {
        $this->connection->transactional(function (Connection $db) use ($digest, $consume): void {
            // Resolve identity without locking; all mutations lock the user first and re-read the request.
            $userId = $db->fetchOne('SELECT user_id FROM password_reset_requests WHERE token_hash = ?', [$digest]);
            if (!is_int($userId) && !is_string($userId)) {
                throw new InvalidRecoveryToken();
            }
            self::lockUser($db, (int) $userId);
            $row = $db->fetchAssociative('SELECT expires_at, consumed_at, superseded_at FROM password_reset_requests WHERE token_hash = ? AND user_id = ? FOR UPDATE', [$digest, $userId]);
            if ($row === false) {
                throw new InvalidRecoveryToken();
            }
            $result = $consume(self::date($row['expires_at']) ?? throw new \LogicException('Missing expiry.'), self::date($row['consumed_at']), self::date($row['superseded_at']));
            $db->update('users', ['password_hash' => $result['hash']], ['id' => $userId]);
            $db->executeStatement('UPDATE password_reset_requests SET consumed_at = ? WHERE token_hash = ?', [self::format($result['at']), $digest]);
            $db->executeStatement("UPDATE recovery_deliveries SET state = 'cancelled', ciphertext = NULL, nonce = NULL, next_due_at = NULL WHERE user_id = ? AND state IN ('pending', 'retrying')", [$userId]);
        });
    }

    private static function lockUser(Connection $db, int $id): void
    {
        if ($db->fetchOne('SELECT id FROM users WHERE id = ? FOR UPDATE', [$id]) === false) {
            throw new InvalidRecoveryToken();
        }
    }

    private static function format(\DateTimeImmutable $date): string
    {
        return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    }

    private static function date(mixed $value): ?\DateTimeImmutable
    {
        return $value === null ? null : (is_string($value) ? new \DateTimeImmutable($value, new \DateTimeZone('UTC')) : throw new \LogicException('Expected timestamp.'));
    }
}
