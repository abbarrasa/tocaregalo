<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\Middleware\MiddlewareInterface;
use Symfony\Component\Messenger\Middleware\StackInterface;
use Symfony\Component\Messenger\Stamp\ReceivedStamp;
use Symfony\Component\Messenger\Stamp\RedeliveryStamp;

final readonly class RecoveryRetryContext implements MiddlewareInterface
{
    public function __construct(private RecoveryDeliveryStore $deliveries)
    {
    }

    public function handle(Envelope $envelope, StackInterface $stack): Envelope
    {
        $message = $envelope->getMessage();
        $count = RedeliveryStamp::getRetryCountFromEnvelope($envelope);
        if ($message instanceof RecoveryMail && $envelope->last(ReceivedStamp::class) !== null && $count > 0) {
            // Recover projection gaps after enqueue/restart from Messenger's authoritative stamp.
            $this->deliveries->retry($message->deliveryId, $count, null);
        }
        return $stack->next()->handle($envelope, $stack);
    }
}
