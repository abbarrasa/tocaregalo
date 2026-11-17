<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Mail;

final readonly class FixtureMail
{
    public function __construct(public string $marker)
    {
        if (preg_match('/^tocaregalo-mail-[a-f0-9]{16}$/D', $marker) !== 1) {
            throw new \InvalidArgumentException('Invalid local mail fixture marker.');
        }
    }
}
