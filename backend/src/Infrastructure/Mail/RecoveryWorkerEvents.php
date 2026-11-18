<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Messenger\Event\WorkerMessageFailedEvent;
use Symfony\Component\Messenger\Event\WorkerMessageRetriedEvent;
use Symfony\Component\Messenger\Event\WorkerRunningEvent;
use Symfony\Component\Messenger\Stamp\DelayStamp;
use Symfony\Component\Messenger\Stamp\RedeliveryStamp;
use App\Application\Port\Clock;

final readonly class RecoveryWorkerEvents implements EventSubscriberInterface
{
    public function __construct(private RecoveryDeliveryStore $deliveries, private Clock $clock)
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [WorkerMessageRetriedEvent::class => 'retried', WorkerMessageFailedEvent::class => ['failed', -200], WorkerRunningEvent::class => 'running'];
    }

    public function retried(WorkerMessageRetriedEvent $event): void
    {
        $envelope = $event->getEnvelope();
        $message = $envelope->getMessage();
        if ($message instanceof RecoveryMail) {
            $delay = $envelope->last(DelayStamp::class)?->getDelay() ?? 0;
            $due = $this->clock->now()->modify('+'.$delay.' milliseconds');
            $this->deliveries->retry($message->deliveryId, RedeliveryStamp::getRetryCountFromEnvelope($envelope), $due);
        }
    }

    public function failed(WorkerMessageFailedEvent $event): void
    {
        $message = $event->getEnvelope()->getMessage();
        if ($message instanceof RecoveryMail && !$event->willRetry()) {
            $this->deliveries->failed($message->deliveryId);
        }
    }

    public function running(WorkerRunningEvent $event): void
    {
        $this->deliveries->cleanup();
    }
}
