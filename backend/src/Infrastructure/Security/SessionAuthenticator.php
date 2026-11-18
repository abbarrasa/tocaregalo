<?php

declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Api\SessionProjection;
use App\Application\Port\PasswordService;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\Exception\InvalidCsrfTokenException;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

final class SessionAuthenticator extends AbstractAuthenticator implements AuthenticationEntryPointInterface
{
    public function __construct(private readonly SessionUserProvider $users, private readonly PasswordService $passwords, private readonly CsrfTokenManagerInterface $csrf)
    {
    }

    public function supports(Request $request): bool
    {
        return $request->getPathInfo() === '/api/login' && $request->isMethod('POST');
    }

    public function authenticate(Request $request): Passport
    {
        if (!$this->csrf->isTokenValid(new CsrfToken('session_mutation', $request->headers->get('X-CSRF-Token')))) {
            throw new InvalidCsrfTokenException();
        }
        if (!in_array($request->getContentTypeFormat(), ['json', 'jsonld'], true)) {
            throw new UnprocessableEntityHttpException();
        }
        try {
            $data = json_decode($request->getContent(), true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new UnprocessableEntityHttpException();
        }
        if (!is_array($data) || count($data) !== 2 || !isset($data['identifier'], $data['password']) || !is_string($data['identifier']) || !is_string($data['password'])) {
            throw new UnprocessableEntityHttpException();
        }
        $user = $this->users->loadUserByIdentifier($data['identifier']);
        if (!$this->passwords->verify($user->domainUser()->passwordHash, $data['password'])) {
            throw new BadCredentialsException();
        }
        return new SelfValidatingPassport(new UserBadge($user->getUserIdentifier(), static fn (): SessionUser => $user));
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): Response
    {
        $user = $token->getUser();
        return $user instanceof SessionUser ? SessionProjection::actor($user) : $this->start($request);
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): Response
    {
        return $exception instanceof InvalidCsrfTokenException
            ? SessionProjection::error('csrf_invalid', 'La solicitud no es válida. Actualiza la sesión y vuelve a intentarlo.', 403)
            : SessionProjection::error('invalid_credentials', 'Credenciales incorrectas.', 401);
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return SessionProjection::error('authentication_required', 'Debes iniciar sesión.', 401);
    }
}
