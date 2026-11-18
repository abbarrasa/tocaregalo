<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118000300 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create protected recovery delivery work and explicit Messenger transport.';
    }

    public function isTransactional(): bool
    {
        return false;
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof AbstractMySQLPlatform, 'MySQL is required.');
        $this->addSql("CREATE TABLE recovery_deliveries (id INT AUTO_INCREMENT NOT NULL PRIMARY KEY, user_id INT NOT NULL, request_id INT NOT NULL, version INT NOT NULL DEFAULT 1, ciphertext TEXT DEFAULT NULL, nonce VARCHAR(64) DEFAULT NULL, message_id VARCHAR(255) NOT NULL, state VARCHAR(32) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0, retry_count INT NOT NULL DEFAULT 0, next_due_at DATETIME(6) DEFAULT NULL, status_code VARCHAR(32) DEFAULT NULL, UNIQUE KEY UNIQ_RECOVERY_REQUEST (request_id), INDEX IDX_RECOVERY_USER (user_id), CONSTRAINT FK_DELIVERY_USER FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT FK_DELIVERY_REQUEST FOREIGN KEY (request_id) REFERENCES password_reset_requests(id) ON DELETE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB");
        // Foundation mail fixtures may already own the installed transport schema.
        if (!$schema->hasTable('messenger_messages')) {
            $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750 (queue_name, available_at, delivered_at, id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB');
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE recovery_deliveries');
        $this->addSql('DROP TABLE messenger_messages');
    }
}
