<?php

declare(strict_types=1);

namespace App\Infrastructure\Validation;

use App\Domain\User\UserProfile;
use App\Domain\User\UserValues;
use Symfony\Component\Validator\Constraints\Email;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final readonly class UserInputValidator implements \App\Application\Port\ProfileValidator
{
    public function __construct(private ValidatorInterface $validator)
    {
    }

    public function validate(string $firstName, ?string $lastName, string $email, string $phone): UserProfile
    {
        $firstName = UserValues::required($firstName);
        $email = $this->email($email);

        return new UserProfile($firstName, $lastName, $email, $phone);
    }

    public function email(string $email): string
    {
        $email = UserValues::required($email);
        if (count($this->validator->validate($email, new Email())) !== 0) {
            throw new \InvalidArgumentException("El correo electrónico no es válido.");
        }

        return $email;
    }
}
