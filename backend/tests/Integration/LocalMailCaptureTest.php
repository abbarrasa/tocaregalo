<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Tests\Fixtures\Mail\FixtureMail;
use App\Tests\Fixtures\Mail\MailFixture;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use App\Tests\Support\NativeProcess;
use App\Tests\Support\TestDatabase;
use PHPUnit\Framework\Attributes\Group;

#[Group('mail')]
final class LocalMailCaptureTest extends KernelTestCase
{
    public function testARealWorkerDeliversTheFixtureToLocalCapture(): void
    {
        self::bootKernel(['environment' => 'test', 'debug' => false]);
        $fixture = self::getContainer()->get(MailFixture::class);
        self::assertInstanceOf(MailFixture::class, $fixture);
        $marker = 'tocaregalo-mail-'.bin2hex(random_bytes(8));
        $fixture->prepareAndDispatch(new FixtureMail($marker));
        $result = NativeProcess::run(['sh', '/runtime/worker.sh', 'messenger:consume', 'notifications', '--limit=1', '--time-limit=15', '--no-interaction', '--quiet']);
        self::assertSame(0, $result['exit'], 'The fixture consumer must exit successfully.');
        $message = $fixture->capturedMessage($marker);
        self::assertSame('Comprobación local '.$marker, $message['Subject'] ?? null);
        self::assertStringContainsString('Mensaje de prueba de Toca Regalo.', json_encode($message, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        $sender = $message['From'] ?? null;
        self::assertIsArray($sender);
        self::assertSame(TestDatabase::environment('MAIL_FROM_ADDRESS'), $sender['Address'] ?? null);
        self::assertSame(TestDatabase::environment('MAIL_FROM_NAME'), $sender['Name'] ?? null);
        $to = $message['To'] ?? null;
        self::assertIsArray($to);
        $recipient = $to[0] ?? null;
        self::assertIsArray($recipient);
        self::assertSame('fixture@tocaregalo.test', $recipient['Address'] ?? null);
        self::assertSame(0, $fixture->queuedCount());
    }
}
