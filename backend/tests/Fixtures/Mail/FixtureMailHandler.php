<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Mail;

use App\Tests\Support\TestDatabase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Mime\Email;

#[AsMessageHandler]
final readonly class FixtureMailHandler
{
    public function __construct(private MailerInterface $mailer)
    {
    }

    public function __invoke(FixtureMail $message): void
    {
        MailFixture::assertLocal(TestDatabase::environment('APP_ENV'), TestDatabase::environment('MAILER_DSN'));
        $this->mailer->send((new Email())->to('fixture@tocaregalo.test')
            ->subject('Comprobación local '.$message->marker)
            ->text('Mensaje de prueba de Toca Regalo. '.$message->marker));
    }
}
