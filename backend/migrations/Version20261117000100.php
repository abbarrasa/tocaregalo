<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117000100 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create identity users, roles and unique user-role membership.';
    }

    public function isTransactional(): bool
    {
        // MySQL DDL commits implicitly; do not pretend a rollback reverses schema changes.
        return false;
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\AbstractMySQLPlatform, 'MySQL is required.');
        $this->addSql('CREATE TABLE roles (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, UNIQUE INDEX UNIQ_B63E2EC75E237E06 (name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ENGINE = InnoDB');
        $this->addSql('CREATE TABLE users (id INT AUTO_INCREMENT NOT NULL, first_name VARCHAR(255) NOT NULL, last_name VARCHAR(255) DEFAULT NULL, email VARCHAR(255) NOT NULL, email_comparison VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, phone VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, UNIQUE INDEX UNIQ_1483A5E949F93409 (email_comparison), UNIQUE INDEX UNIQ_1483A5E9444F97DD (phone), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ENGINE = InnoDB');
        $this->addSql('CREATE TABLE user_roles (user_id INT NOT NULL, role_id INT NOT NULL, INDEX IDX_54FCD59FD60322AC (role_id), PRIMARY KEY(user_id, role_id), CONSTRAINT FK_USER_ROLE_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, CONSTRAINT FK_USER_ROLE_ROLE FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE user_roles');
        $this->addSql('DROP TABLE users');
        $this->addSql('DROP TABLE roles');
    }
}
