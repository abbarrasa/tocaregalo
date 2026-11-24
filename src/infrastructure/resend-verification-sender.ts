import { VerificationDeliveryError, type VerificationMessage, type VerificationSender } from '../application/email-verification-service.ts';
import { ResendTransport, type ResendConfiguration } from './resend-transport.ts';

export class ResendVerificationSender implements VerificationSender {
  private readonly transport: ResendTransport;
  constructor(configuration: ResendConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.transport = new ResendTransport(configuration, sendRequest);
  }

  async send(message: VerificationMessage): Promise<void> {
    try {
      await this.transport.send(message.email, 'Confirma tu correo en TocaRegalo',
        'Tu código de verificación de TocaRegalo:\n\n' + message.token
        + '\n\nIntroduce este código en TocaRegalo para confirmar tu correo.\n'
        + 'Caduca el ' + new Date(message.expiresAtMs).toISOString() + '.\n'
        + 'Si no lo has solicitado, puedes ignorar este correo.');
    } catch { throw new VerificationDeliveryError(); }
  }
}
