<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Tests\Fixtures\Mail\MailFixture;
use PHPUnit\Framework\TestCase;

final class LocalMailPolicyTest extends TestCase
{
    public function testUnsafeDatabaseIsRejectedBeforeTransportSetupOrDispatch(): void
    {
        $transport = $this->createMock(\Symfony\Component\Messenger\Transport\TransportInterface::class);
        $transport->expects(self::never())->method('send');
        $bus = $this->createMock(\Symfony\Component\Messenger\MessageBusInterface::class);
        $bus->expects(self::never())->method('dispatch');
        $server = $_SERVER;
        try {
            $_SERVER = array_replace($_SERVER, [
                'APP_ENV' => 'test',
                'MAILER_DSN' => 'smtp://tocaregalo-mailpit:1025',
                'DATABASE_URL' => 'mysql://fixture:fixture@tocaregalo-mysql/tocaregalo',
                'TEST_DATABASE_URL' => 'mysql://fixture:fixture@tocaregalo-mysql/tocaregalo',
                'TEST_MYSQL_DATABASE' => 'tocaregalo_test',
                'MYSQL_DATABASE' => 'tocaregalo',
            ]);
            $this->expectException(\LogicException::class);
            $this->expectExceptionMessage('Refusing an unsafe test database target.');
            (new MailFixture($transport, $bus))->prepareAndDispatch(new \App\Tests\Fixtures\Mail\FixtureMail('tocaregalo-mail-0000000000000000'));
        } finally {
            $_SERVER = $server;
        }
    }

    public function testExternalSmtpIsRejectedBeforeFixtureDelivery(): void
    {
        $this->expectException(\LogicException::class);
        MailFixture::assertLocal('test', 'smtp://external.invalid:25');
    }

    public function testProductionEnvironmentIsRejectedBeforeFixtureSetup(): void
    {
        $this->expectException(\LogicException::class);
        MailFixture::assertLocal('prod', 'smtp://tocaregalo-mailpit:1025');
    }
}
