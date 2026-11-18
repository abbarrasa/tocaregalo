<?php

declare(strict_types=1);

namespace App\Api;

use App\Infrastructure\Security\SessionUser;
use Symfony\Component\HttpFoundation\JsonResponse;

final class SessionProjection
{
    public static function actor(SessionUser $principal): JsonResponse
    {
        $user = $principal->domainUser();
        return self::json(['id' => $user->id, 'firstName' => $user->profile->firstName, 'lastName' => $user->profile->lastName, 'email' => $user->profile->email, 'phone' => $user->profile->phone, 'roles' => $principal->getRoles()]);
    }

    /** @param array<string, mixed> $data */
    public static function json(array $data, int $status = 200): JsonResponse
    {
        return new JsonResponse($data, $status, ['Cache-Control' => 'no-store, private']);
    }

    public static function error(string $key, string $message, int $status): JsonResponse
    {
        return self::json(['status' => $status, 'error' => $key, 'message' => $message], $status);
    }
}
