<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class RecoveryMailHandler
{
    public function __construct(private RecoveryDeliveryStore $deliveries)
    {
    }

    public function __invoke(RecoveryMail $message): void
    {
        $this->deliveries->deliver($message->deliveryId);
    }
}
