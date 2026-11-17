<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:fixture:worker-probe', description: 'Bounded test-only process-contract probe.')]
final class WorkerProbeCommand extends Command
{
    protected function configure(): void
    {
        $this->addOption('interval', null, InputOption::VALUE_REQUIRED, 'Probe interval in seconds.', '15');
        $this->addOption('cycles', null, InputOption::VALUE_REQUIRED, 'Maximum test ticks.', '2');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        if ($input->getOption('interval') !== '15' || !in_array($input->getOption('cycles'), ['1', '2'], true)) {
            $output->writeln('Invalid bounded fixture arguments.');
            return Command::INVALID;
        }
        $output->writeln('fixture-ready interval=15');
        if ($input->getOption('cycles') === '2') {
            sleep(15);
            $output->writeln('fixture-tick interval=15');
        }
        return Command::SUCCESS;
    }
}
