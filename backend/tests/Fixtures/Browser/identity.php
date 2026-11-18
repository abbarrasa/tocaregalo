<?php

declare(strict_types=1);

require dirname(__DIR__, 2).'/bootstrap.php';

use App\Domain\User\Role;
use App\Domain\User\User;
use App\Domain\User\UserProfile;
use App\Infrastructure\Doctrine\DoctrineUserRepository;
use App\Infrastructure\Security\SymfonyPasswordService;
use App\Tests\Support\TestDatabase;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

if (TestDatabase::environment('RECOVERY_BROWSER_FIXTURE') !== '1') {
    throw new \LogicException('Browser fixtures require their explicit isolated mode.');
}
$database = TestDatabase::fromEnvironment();
$connection = $database->connection();
$action = $argv[1] ?? '';
$kernel = new \App\Kernel('test', false);
try {
    if ($action === 'init') {
        $kernel->boot();
        $registry = $kernel->getContainer()->get('doctrine');
        if (!$registry instanceof \Doctrine\Persistence\ManagerRegistry) {
            throw new \LogicException('Missing ORM registry.');
        }
        $manager = $registry->getManager();
        if (!$manager instanceof EntityManagerInterface) {
            throw new \LogicException('Missing ORM.');
        }
        foreach (['driver', 'host', 'port', 'dbname', 'user', 'password'] as $key) {
            if (($connection->getParams()[$key] ?? null) !== ($manager->getConnection()->getParams()[$key] ?? null)) {
                throw new \LogicException('Browser ORM target differs from guarded database.');
            }
        }
        $application = new Application($kernel);
        $application->setAutoExit(false);
        $application->setCatchExceptions(false);
        $input = new ArrayInput(['command' => 'doctrine:migrations:migrate', 'version' => 'latest', '--no-interaction' => true]);
        $input->setInteractive(false);
        if ($application->run($input, new BufferedOutput()) !== 0) {
            throw new \RuntimeException('Browser fixture migrations failed.');
        }
        $repository = new DoctrineUserRepository($manager);
        foreach ([[Role::USER, 'Ana', 'ana@example.test', '+34600123456'], [Role::SUPER_ADMIN, 'Super', 'super@example.test', '+34600123457']] as [$roleName, $firstName, $email, $phone]) {
            $role = $repository->saveRole(new Role($roleName));
            $repository->save(new User(new UserProfile($firstName, null, $email, $phone), (new SymfonyPasswordService())->hash(' initial password '), [$role]));
        }
        echo "Isolated identity fixtures ready.\n";
    } elseif ($action === 'serve') {
        $directory = TestDatabase::environment('IDENTITY_CONTROL_DIR');
        if ($directory !== '/runtime/identity-control' || !is_dir($directory)) {
            throw new \LogicException('Unexpected browser control directory.');
        }
        $deadline = time() + 1800;
        while (time() < $deadline) {
            foreach (glob($directory.'/*.request.json') ?: [] as $file) {
                $result = 'failed';
                try {
                    $contents = file_get_contents($file);
                    $data = is_string($contents) ? json_decode($contents, true, flags: JSON_THROW_ON_ERROR) : null;
                    if (!is_array($data) || !in_array($data['action'] ?? '', ['reset', 'expire'], true)) {
                        throw new \LogicException('Invalid browser fixture command.');
                    }
                    if ($data['action'] === 'reset') {
                        $hash = (new SymfonyPasswordService())->hash(' initial password ');
                        $connection->transactional(static function (\Doctrine\DBAL\Connection $db) use ($hash): void {
                            $db->fetchAllAssociative('SELECT id FROM users ORDER BY id FOR UPDATE');
                            $db->executeStatement('DELETE FROM messenger_messages');
                            $db->executeStatement('DELETE FROM password_reset_requests');
                            $db->executeStatement('DELETE FROM sessions');
                            $db->executeStatement('UPDATE users SET password_hash = ?', [$hash]);
                        });
                    } else {
                        $connection->transactional(static function (\Doctrine\DBAL\Connection $db): void {
                            $db->fetchAllAssociative('SELECT id FROM users ORDER BY id FOR UPDATE');
                            $db->executeStatement("UPDATE password_reset_requests SET expires_at = '2000-01-01 00:00:00'");
                        });
                    }
                    $result = 'ok';
                } catch (\Throwable) {
                    // Do not publish credential-bearing exception details into control acknowledgements.
                }
                file_put_contents(str_replace('.request.json', '.response.json', $file), $result);
                unlink($file);
            }
            usleep(20000);
        }
    } else {
        throw new \LogicException('Unsupported browser fixture action.');
    }
} finally {
    $kernel->shutdown();
    $database->close();
}
