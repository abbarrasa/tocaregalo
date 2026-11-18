<?php

declare(strict_types=1);

use App\Application\Port\AccountStore;
use App\Application\User\AccountInput;
use App\Application\User\AccountUniqueness;
use App\Application\User\AccountValidation;
use App\Application\User\CreateOrdinaryUser;
use App\Application\User\UpdateOwnAccount;
use App\Domain\User\User;
use App\Domain\User\UserProfile;
use App\Infrastructure\Doctrine\DoctrineAccountStore;
use App\Infrastructure\Doctrine\DoctrineUserRepository;
use App\Infrastructure\Security\SymfonyPasswordService;
use App\Infrastructure\Validation\UserInputValidator;
use App\Tests\Support\TestDatabase;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Validator\Validation;

require dirname(__DIR__, 2).'/bootstrap.php';
$guard = TestDatabase::fromEnvironment();
$kernel = new App\Kernel('test', false);
$kernel->boot();
try {
    $registry = $kernel->getContainer()->get('doctrine');
    if (!$registry instanceof \Doctrine\Persistence\ManagerRegistry) {
        throw new LogicException('Missing test registry.');
    }
    $manager = $registry->getManager();
    if (!$manager instanceof EntityManagerInterface) {
        throw new LogicException('Missing test ORM.');
    }
    foreach (['driver', 'host', 'port', 'dbname', 'user', 'password'] as $key) {
        if (($guard->connection()->getParams()[$key] ?? null) !== ($manager->getConnection()->getParams()[$key] ?? null)) {
            throw new LogicException('Unsafe race target.');
        }
    }
    $directory = $argv[1] ?? '';
    $operation = $argv[2] ?? '';
    $field = $argv[3] ?? '';
    $id = (int) ($argv[4] ?? '0');
    if (!is_dir($directory) || !in_array($operation, ['create', 'update'], true) || !in_array($field, ['email', 'phone'], true)) {
        throw new LogicException('Invalid bounded race fixture.');
    }
    $barrier = new class(new DoctrineAccountStore($manager->getConnection()), $directory) implements AccountStore {
        public function __construct(private readonly AccountStore $inner, private readonly string $directory)
        {
        }
        private function wait(): void
        {
            file_put_contents($this->directory.'/ready', '1');
            $deadline = microtime(true) + 30;
            while (!is_file($this->directory.'/go')) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Race barrier timed out.');
                }
                usleep(20000);
            }
        }
        public function create(UserProfile $profile, string $passwordHash): User
        {
            $this->wait();
            return $this->inner->create($profile, $passwordHash);
        }
        public function update(int $id, callable $change): User
        {
            return $this->inner->update($id, function (User $current) use ($change): User {
                $updated = $change($current);
                $this->wait();
                return $updated;
            });
        }
    };
    $input = new AccountInput(new UserInputValidator(Validation::createValidator()));
    $uniqueness = new AccountUniqueness(new DoctrineUserRepository($manager));
    $passwords = new SymfonyPasswordService();
    try {
        if ($operation === 'create') {
            (new CreateOrdinaryUser($barrier, $input, $uniqueness, $passwords))->create(['firstName' => 'Loser', 'lastName' => null, 'email' => 'race@example.test', 'phone' => '+12025550101', 'password' => 'fixture password']);
        } else {
            (new UpdateOwnAccount($barrier, $input, $uniqueness, $passwords))->update($id, $id, [$field => $field === 'email' ? 'race@example.test' : '+12025550101']);
        }
        echo json_encode(['unexpected_success'], JSON_THROW_ON_ERROR);
    } catch (AccountValidation $exception) {
        echo json_encode(array_keys($exception->fields), JSON_THROW_ON_ERROR);
    }
} catch (Throwable) {
    echo 'fixture_failed';
    exit(2);
} finally {
    $kernel->shutdown();
    $guard->close();
}
