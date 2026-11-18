<?php

declare(strict_types=1);

namespace App\Domain\User;

final readonly class UserProfile
{
    public string $firstName;
    public ?string $lastName;
    public string $email;
    public string $emailComparison;
    public string $phone;

    public function __construct(string $firstName, ?string $lastName, string $email, string $phone)
    {
        $this->firstName = UserValues::required($firstName);
        $this->lastName = UserValues::lastName($lastName);
        $this->email = UserValues::required($email);
        $this->emailComparison = UserValues::emailComparison($this->email);
        $this->phone = UserValues::phone($phone);
    }
}
