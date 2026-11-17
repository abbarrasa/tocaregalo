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
        $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
        $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];
        $title = match ($status) {
            404 => 'Recurso no encontrado',
            405 => 'Método no permitido',
            default => 'No se pudo completar la solicitud',
        };
        $event->setResponse(new JsonResponse(['status' => $status, 'title' => $title], $status, $headers));
    }
}
