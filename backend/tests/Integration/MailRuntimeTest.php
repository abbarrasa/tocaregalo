<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Kernel;
use App\Tests\Fixtures\Mail\FixtureMail;
use App\Tests\Fixtures\Mail\MailFixture;
use App\Tests\Support\NativeProcess;
use App\Tests\Support\TestDatabase;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\Retry\RetryStrategyInterface;
use Symfony\Component\Messenger\Stamp\RedeliveryStamp;

#[Group('mail')]
final class MailRuntimeTest extends KernelTestCase
{
    public function testFixtureServicesDoNotExistInDevelopment(): void
    {
        $kernel = new Kernel('dev', false);
        try {
            $kernel->boot();
            self::assertFalse($kernel->getContainer()->has(MailFixture::class));
        } finally {
            $kernel->shutdown();
        }
    }

    public function testConfiguredRetryDelaysHaveNoJitterOrCap(): void
    {
        self::bootKernel(['environment' => 'test', 'debug' => false]);
        $strategy = self::getContainer()->get('test.notifications_retry_strategy');
        self::assertInstanceOf(RetryStrategyInterface::class, $strategy);
        $base = (int) TestDatabase::environment('NOTIFICATION_RETRY_BASE_MS');
        for ($retry = 0; $retry < 5; ++$retry) {
            $envelope = new Envelope(new FixtureMail('tocaregalo-mail-0000000000000000'), [new RedeliveryStamp($retry)]);
            self::assertSame($base * (2 ** $retry), $strategy->getWaitingTime($envelope));
            self::assertTrue($strategy->isRetryable($envelope));
        }
        self::assertFalse($strategy->isRetryable(new Envelope(new FixtureMail('tocaregalo-mail-0000000000000000'), [new RedeliveryStamp(5)])));
    }

    public function testSchedulerDelegatesToTheBoundedTestProbe(): void
    {
        $result = NativeProcess::run(['sh', '/runtime/scheduler.sh', 'app:fixture:worker-probe', '--interval=15', '--cycles=2']);
        self::assertSame(0, $result['exit']);
        self::assertStringContainsString('fixture-ready interval=15', $result['output']);
        self::assertStringContainsString('fixture-tick interval=15', $result['output']);
    }

    public function testMissingProductionClosureCommandFailsVisibly(): void
    {
        $result = NativeProcess::run(['sh', '/runtime/scheduler.sh']);
        self::assertNotSame(0, $result['exit']);
        self::assertStringContainsString('app:events', $result['output']);
    }

    public function testBothLaunchersPreserveInvalidArgumentFailure(): void
    {
        foreach (['worker', 'scheduler'] as $launcher) {
            $result = NativeProcess::run(['sh', '/runtime/'.$launcher.'.sh', 'app:fixture:worker-probe', '--interval=1']);
            self::assertSame(2, $result['exit']);
        }
    }
}
