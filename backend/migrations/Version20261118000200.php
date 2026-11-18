<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118000200 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create hash-only password recovery requests.';
    }

    public function isTransactional(): bool
    {
        return false;
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof AbstractMySQLPlatform, 'MySQL is required.');
        $this->addSql('CREATE TABLE password_reset_requests (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, token_hash VARCHAR(64) NOT NULL, issued_at DATETIME(6) NOT NULL, expires_at DATETIME(6) NOT NULL, consumed_at DATETIME(6) DEFAULT NULL, superseded_at DATETIME(6) DEFAULT NULL, UNIQUE INDEX UNIQ_RESET_TOKEN (token_hash), INDEX IDX_RESET_USER (user_id), PRIMARY KEY(id), CONSTRAINT FK_RESET_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE password_reset_requests');
    }
}
