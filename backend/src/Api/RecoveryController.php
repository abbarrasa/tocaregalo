<?php

declare(strict_types=1);

namespace App\Api;

use App\Application\Recovery\InvalidRecoveryToken;
use App\Application\Recovery\RecoveryTokens;
use App\Application\Recovery\RequestRecovery;
use App\Application\User\AccountValidation;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

final readonly class RecoveryController
{
    public function __construct(private CsrfTokenManagerInterface $csrf, private RequestRecovery $requests, private RecoveryTokens $tokens)
    {
    }

    public function request(Request $request): Response
    {
        return $this->execute($request, false);
    }

    public function reset(Request $request): Response
    {
        return $this->execute($request, true);
    }

    private function execute(Request $request, bool $reset): Response
    {
        $errorField = $reset ? 'password' : 'identifier';
        if (!$this->csrf->isTokenValid(new CsrfToken('session_mutation', $request->headers->get('X-CSRF-Token')))) {
            return SessionProjection::error('csrf_invalid', 'La solicitud no es válida. Actualiza la sesión y vuelve a intentarlo.', 403);
        }
        try {
            $fields = $reset ? ['token', 'password'] : ['identifier'];
            try {
                $values = in_array($request->getContentTypeFormat(), ['json', 'jsonld'], true) ? json_decode($request->getContent(), true, flags: JSON_THROW_ON_ERROR) : null;
            } catch (\JsonException) {
                $values = null;
            }
            if (!is_array($values) || array_is_list($values)) {
                throw new AccountValidation(['_form' => 'Se requiere un objeto JSON válido.']);
            }
            foreach ($values as $key => $value) {
                if (!in_array($key, $fields, true)) {
                    throw new AccountValidation([(string) $key => 'Este campo no está permitido.']);
                }
            }
            $input = [];
            foreach ($fields as $field) {
                $value = $values[$field] ?? null;
                if (!is_string($value)) {
                    throw new AccountValidation([$field => 'Este campo es obligatorio y debe ser texto.']);
                }
                $input[$field] = $value;
            }
            if ($reset) {
                $this->tokens->reset($input['token'] ?? throw new \LogicException("Missing token."), $input['password']);
                return new Response('', 204, ['Cache-Control' => 'no-store, private']);
            }
            $this->requests->request($input['identifier'] ?? throw new \LogicException("Missing identifier."));
            return SessionProjection::json(['message' => 'Si existe una cuenta con esos datos, recibirás un enlace para restablecer la contraseña.'], 202);
        } catch (InvalidRecoveryToken) {
            return $this->invalid(['token' => 'El enlace de recuperación no es válido o ha caducado.']);
        } catch (AccountValidation $exception) {
            return $this->invalid($exception->fields);
        } catch (\InvalidArgumentException $exception) {
            return $this->invalid([$errorField => $exception->getMessage()]);
        } catch (\Throwable) {
            return SessionProjection::error('service_unavailable', 'No se puede completar la solicitud. Inténtalo de nuevo más tarde.', 503);
        }
    }

    /** @param array<string, string> $fields */
    private function invalid(array $fields): Response
    {
        return SessionProjection::json(['status' => 422, 'error' => 'invalid_input', 'message' => 'Los datos no son válidos.', 'fields' => $fields], 422);
    }
}
