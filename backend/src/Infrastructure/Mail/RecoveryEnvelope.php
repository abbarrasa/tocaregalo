<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

final readonly class RecoveryEnvelope
{
    public function __construct(#[\SensitiveParameter] private string $encodedKey)
    {
    }

    public function validate(): void
    {
        $this->key();
    }

    private function key(): string
    {
        $key = base64_decode($this->encodedKey, true);
        if (!is_string($key) || strlen($key) !== 32 || base64_encode($key) !== $this->encodedKey) {
            throw new DeliveryUnavailable();
        }
        return $key;
    }

    /** @return array{version: int, ciphertext: string, nonce: string} */
    public function seal(#[\SensitiveParameter] string $token, int $requestId, int $deliveryId): array
    {
        $nonce = random_bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
        return ['version' => 1, 'ciphertext' => base64_encode(sodium_crypto_aead_xchacha20poly1305_ietf_encrypt($token, self::context($requestId, $deliveryId), $nonce, $this->key())), 'nonce' => base64_encode($nonce)];
    }

    /** @param array{version: int, ciphertext: string, nonce: string} $envelope */
    public function open(array $envelope, int $requestId, int $deliveryId): string
    {
        try {
            $nonce = base64_decode($envelope['nonce'], true);
            $ciphertext = base64_decode($envelope['ciphertext'], true);
            if ($envelope['version'] !== 1 || !is_string($nonce) || strlen($nonce) !== 24 || !is_string($ciphertext)) {
                throw new DeliveryUnavailable();
            }
            $token = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt($ciphertext, self::context($requestId, $deliveryId), $nonce, $this->key());
            return is_string($token) ? $token : throw new DeliveryUnavailable();
        } catch (\Throwable) {
            throw new DeliveryUnavailable();
        }
    }

    private static function context(int $requestId, int $deliveryId): string
    {
        return 'tocaregalo:recovery:1:'.$requestId.':'.$deliveryId;
    }
}
