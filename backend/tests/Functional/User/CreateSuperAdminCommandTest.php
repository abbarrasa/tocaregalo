<?php

declare(strict_types=1);

namespace App\Tests\Functional\User;

use App\Kernel;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

final class CreateSuperAdminCommandTest extends TestCase
{
    public function testNoninteractiveCommandRefusesBeforeDatabaseAccess(): void
    {
        $kernel = new Kernel('test', false);
        try {
            $application = new Application($kernel);
            $tester = new CommandTester($application->find('app:user:create-super-admin'));
            self::assertSame(2, $tester->execute([], ['interactive' => false]));
            self::assertStringContainsString('interactivo', $tester->getDisplay());
        } finally {
            $kernel->shutdown();
        }
    }
}
