import type { InvitationMessage, InvitationSender } from '../application/invitation-service.ts';
import { SendgridTransport, type SendgridConfiguration } from './sendgrid-transport.ts';

export class SendgridInvitationSender implements InvitationSender {
  private readonly transport: SendgridTransport;
  constructor(configuration: SendgridConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.transport = new SendgridTransport(configuration, sendRequest);
  }

  async send(message: InvitationMessage): Promise<void> {
    await this.transport.send(message.email, 'Invitación a un grupo de TocaRegalo',
      'Te han invitado al grupo ' + message.groupName + ' en TocaRegalo.\n\n'
      + 'Tu código de invitación:\n\n' + message.token
      + '\n\nInicia sesión con este correo e introduce el código para aceptar. '
      + 'Si no tienes cuenta, regístrate primero con este mismo correo.\n'
      + 'Caduca el ' + new Date(message.expiresAtMs).toISOString() + '.\n'
      + 'Si no quieres participar, puedes ignorar este correo.');
  }
}
