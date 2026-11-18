<?php

declare(strict_types=1);

namespace App\Command;

use App\Application\User\CreateSuperAdmin;
use App\Domain\User\PasswordPolicy;
use App\Domain\User\UserValues;
use App\Infrastructure\Validation\UserInputValidator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\Question;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:user:create-super-admin', description: 'Crea una cuenta SUPER ADMIN de forma interactiva.')]
final class CreateSuperAdminCommand extends Command
{
    public function __construct(private readonly UserInputValidator $validator, private readonly CreateSuperAdmin $creator)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        if (!$input->isInteractive()) {
            $io->error('Este comando requiere modo interactivo. Ejecútalo sin --no-interaction.');
            return Command::INVALID;
        }
        try {
            $email = self::answer($io->askQuestion((new Question('Correo electrónico'))->setValidator(fn (mixed $value): string => $this->validator->email(is_string($value) ? $value : ''))->setMaxAttempts(3)));
            $firstName = self::answer($io->askQuestion((new Question('Nombre'))->setValidator(static fn (mixed $value): string => UserValues::required(is_string($value) ? $value : ''))->setMaxAttempts(3)));
            $lastName = $io->askQuestion((new Question('Apellidos (opcional)'))->setValidator(static fn (mixed $value): ?string => UserValues::lastName(is_string($value) ? $value : null))->setMaxAttempts(3));
            $phone = self::answer($io->askQuestion((new Question('Teléfono con prefijo +'))->setValidator(static fn (mixed $value): string => UserValues::phone(is_string($value) ? $value : ''))->setMaxAttempts(3)));
            $question = $this->secret('Contraseña (mínimo 6 caracteres, máximo 4096 bytes UTF-8)');
            $question->setValidator(static fn (#[\SensitiveParameter] mixed $value): string => PasswordPolicy::validate(is_string($value) ? $value : ''));
            $password = self::answer($io->askQuestion($question));
            $confirmation = $this->secret('Repite la contraseña');
            $confirmation->setValidator(static function (#[\SensitiveParameter] mixed $value) use ($password): string {
                if (!is_string($value) || !hash_equals($password, $value)) {
                    throw new \InvalidArgumentException('Las contraseñas no coinciden.');
                }
                return $value;
            });
            $io->askQuestion($confirmation);
            $profile = $this->validator->validate($firstName, is_string($lastName) ? $lastName : null, $email, $phone);
            $this->creator->create($profile, $password);
            unset($password);
        } catch (\DomainException|\InvalidArgumentException $exception) {
            $io->error($exception->getMessage());
            return Command::FAILURE;
        } catch (\Throwable) {
            $io->error('No se ha creado la cuenta. Comprueba los datos, la conexión y las migraciones o vuelve a intentarlo.');
            return Command::FAILURE;
        }
        $io->success('Cuenta SUPER ADMIN creada correctamente.');
        return Command::SUCCESS;
    }

    private static function answer(mixed $value): string
    {
        if (!is_string($value)) {
            throw new \InvalidArgumentException('La respuesta no es válida.');
        }
        return $value;
    }

    private function secret(string $prompt): Question
    {
        return (new Question($prompt))->setHidden(true)->setHiddenFallback(false)->setTrimmable(false)
            ->setNormalizer(static fn (mixed $value): mixed => is_string($value) ? rtrim($value, "\r\n") : $value)
            ->setMaxAttempts(3);
    }
}
