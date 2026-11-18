<?php

declare(strict_types=1);

namespace App\Api;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

final class JsonResponseSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::REQUEST => ['forceJson', 300], KernelEvents::EXCEPTION => ['handleException', 300]];
    }

    public function forceJson(RequestEvent $event): void
    {
        $event->getRequest()->headers->set('Accept', 'application/ld+json');
        $event->getRequest()->setRequestFormat('jsonld');
    }

    public function handleException(ExceptionEvent $event): void
    {
        $exception = $event->getThrowable();
        if ($exception instanceof \Symfony\Component\Security\Core\Exception\AuthenticationException || $exception instanceof \Symfony\Component\Security\Core\Exception\AccessDeniedException) {
            return;
        }
        $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
        $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];
        $title = match ($status) {
            404 => 'Recurso no encontrado',
            405 => 'Método no permitido',
            422 => 'Los datos de la solicitud no son válidos',
            default => 'No se pudo completar la solicitud',
        };
        $data = ['status' => $status, 'title' => $title];
        if ($status === 422) {
            $data['error'] = 'invalid_input';
        }
        $event->setResponse(new JsonResponse($data, $status, $headers));
    }
}
