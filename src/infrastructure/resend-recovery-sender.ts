import type { RecoverySender } from '../application/password-recovery-service.ts';
import { ResendTransport, type ResendConfiguration } from './resend-transport.ts';

export class ResendRecoverySender implements RecoverySender {
  private readonly transport: ResendTransport;
  constructor(configuration: ResendConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.transport = new ResendTransport(configuration, sendRequest);
  }

  async send(message: { email: string; token: string; expiresAtMs: number }): Promise<void> {
    await this.transport.send(message.email, 'Recupera tu contraseña de TocaRegalo',
      'Tu código para restablecer la contraseña de TocaRegalo:\n\n' + message.token
      + '\n\nIntroduce este código junto con tu nueva contraseña en TocaRegalo.\n'
      + 'Caduca el ' + new Date(message.expiresAtMs).toISOString() + '.\n'
      + 'Si no lo has solicitado, puedes ignorar este correo.');
  }
}
