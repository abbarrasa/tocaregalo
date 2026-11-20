import type { DrawNotificationSender } from '../application/draw-notification-service.ts';
import type { DrawNotificationMessage } from '../domain/draw-notifications.ts';
import { SendgridTransport, type SendgridConfiguration } from './sendgrid-transport.ts';

export class SendgridDrawNotificationSender implements DrawNotificationSender {
  private readonly transport: SendgridTransport;
  constructor(configuration: SendgridConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.transport = new SendgridTransport(configuration, sendRequest);
  }

  async send(message: DrawNotificationMessage): Promise<void> {
    await this.transport.send(message.email, 'Sorteo disponible en TocaRegalo',
      'Un evento en el que participas se ha cerrado.\n\n'
      + 'Inicia sesión en TocaRegalo para consultar tu asignación de forma privada.\n'
      + 'Identificador del evento: ' + message.eventId + '\n'
      + 'Este aviso no contiene tu destinatario ni permite acceder sin iniciar sesión.');
  }
}
