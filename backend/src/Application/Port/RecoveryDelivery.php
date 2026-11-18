<?php

declare(strict_types=1);

namespace App\Application\Port;

use App\Application\Recovery\IssuedRecovery;

interface RecoveryDelivery
{
    public function validate(): void;

    public function enqueue(int $userId, int $requestId, #[\SensitiveParameter] IssuedRecovery $issued): void;
}
