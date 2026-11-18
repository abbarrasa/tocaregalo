<?php

declare(strict_types=1);

namespace App\Api;

use App\Infrastructure\Security\SessionUser;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

final readonly class SessionController
{
    public function __construct(private TokenStorageInterface $tokens, private CsrfTokenManagerInterface $csrf)
    {
    }

    public function csrf(): Response
    {
        return SessionProjection::json(['csrfToken' => $this->csrf->getToken('session_mutation')->getValue()]);
    }

    public function me(): Response
    {
        $user = $this->tokens->getToken()?->getUser();
        return $user instanceof SessionUser ? SessionProjection::actor($user) : SessionProjection::error('authentication_required', 'Debes iniciar sesión.', 401);
    }

    public function login(): Response
    {
        return SessionProjection::error('invalid_credentials', 'Credenciales incorrectas.', 401);
    }

    public function logout(Request $request): Response
    {
        if (!$this->csrf->isTokenValid(new CsrfToken('session_mutation', $request->headers->get('X-CSRF-Token')))) {
            return SessionProjection::error('csrf_invalid', 'La solicitud no es válida. Actualiza la sesión y vuelve a intentarlo.', 403);
        }
        $this->tokens->setToken(null);
        $request->getSession()->invalidate();
        $response = new Response(null, 204, ['Cache-Control' => 'no-store, private']);
        $response->headers->clearCookie('TOCAREGALO_SESSION', '/', secure: $request->isSecure(), httpOnly: true, sameSite: 'lax');
        return $response;
    }
}
