<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

final readonly class RecoveryLink
{
    public function __construct(private string $publicUrl, private string $environment)
    {
    }

    public function validate(): void
    {
        $url = parse_url($this->publicUrl);
        if (!is_array($url) || !is_string($url['host'] ?? null) || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) || preg_match('/[\x00-\x20\x7f]/', $this->publicUrl) !== 0) {
            throw new DeliveryUnavailable();
        }
        $scheme = $url['scheme'] ?? '';
        if ($scheme !== 'https' && !($scheme === 'http' && in_array($this->environment, ['dev', 'test'], true) && in_array($url['host'], ['localhost', '127.0.0.1', '[::1]'], true))) {
            throw new DeliveryUnavailable();
        }
    }

    public function url(#[\SensitiveParameter] string $token): string
    {
        $this->validate();
        return rtrim($this->publicUrl, '/').'/password-reset#token='.rawurlencode($token);
    }
}
