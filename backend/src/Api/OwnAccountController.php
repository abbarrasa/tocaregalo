<?php

declare(strict_types=1);

namespace App\Api;

use App\Application\User\AccountAccessDenied;
use App\Application\User\AccountValidation;
use App\Application\User\UpdateOwnAccount;
use App\Infrastructure\Security\SessionUser;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

final readonly class OwnAccountController
{
    public function __construct(private TokenStorageInterface $tokens, private CsrfTokenManagerInterface $csrf, private UpdateOwnAccount $updates)
    {
    }

    public function update(Request $request): Response
    {
        $actor = $this->tokens->getToken()?->getUser();
        if (!$actor instanceof SessionUser) {
            return SessionProjection::error('authentication_required', 'Debes iniciar sesión.', 401);
        }
        if (!$this->csrf->isTokenValid(new CsrfToken('session_mutation', $request->headers->get('X-CSRF-Token')))) {
            return SessionProjection::error('csrf_invalid', 'La solicitud no es válida. Actualiza la sesión y vuelve a intentarlo.', 403);
        }
        try {
            if (!in_array($request->getContentTypeFormat(), ['json', 'jsonld'], true)) {
                throw new AccountValidation(['_form' => 'Se requiere un objeto JSON.']);
            }
            try {
                $values = json_decode($request->getContent(), true, flags: JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new AccountValidation(['_form' => 'Se requiere un objeto JSON válido.']);
            }
            if (!is_array($values) || array_is_list($values)) {
                throw new AccountValidation(['_form' => 'Indica los campos que quieres modificar.']);
            }
            $id = (int) $actor->getUserIdentifier();
            $updated = $this->updates->update($id, $id, $values);
            return SessionProjection::actor(new SessionUser($updated));
        } catch (AccountValidation $exception) {
            return SessionProjection::json(['status' => 422, 'error' => 'invalid_input', 'message' => $exception->getMessage(), 'fields' => $exception->fields], 422);
        } catch (AccountAccessDenied) {
            return SessionProjection::error('forbidden', 'No puedes modificar esa cuenta.', 403);
        }
    }
}
