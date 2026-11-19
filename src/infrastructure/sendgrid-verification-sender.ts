import { VerificationDeliveryError, type VerificationMessage, type VerificationSender } from '../application/email-verification-service.ts';
import { normalizeEmail } from '../domain/authentication.ts';

type SendgridConfiguration = Readonly<{ apiKey: string | undefined; fromEmail: string | undefined }>;

export class SendgridVerificationSender implements VerificationSender {
  private readonly configuration: SendgridConfiguration;
  private readonly sendRequest: typeof fetch;
  constructor(configuration: SendgridConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.configuration = configuration; this.sendRequest = sendRequest;
  }

  async send(message: VerificationMessage): Promise<void> {
    const { apiKey, fromEmail } = this.configuration;
    if (!apiKey?.trim() || /[\r\n]/.test(apiKey) || !fromEmail) throw new VerificationDeliveryError();
    let from: string;
    try { from = normalizeEmail(fromEmail); } catch { throw new VerificationDeliveryError(); }
    try {
      const response = await this.sendRequest('https://api.sendgrid.com/v3/mail/send', {
        // Workers supports manual/follow, not redirect:error. Never forward credentials to a redirect target.
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.email }] }],
          from: { email: from, name: 'TocaRegalo' },
          subject: 'Confirma tu correo en TocaRegalo',
          content: [{ type: 'text/plain', value: 'Tu código de verificación de TocaRegalo:\n\n'
            + message.token + '\n\nIntroduce este código en TocaRegalo para confirmar tu correo.\n'
            + 'Caduca el ' + new Date(message.expiresAtMs).toISOString() + '.\n'
            + 'Si no lo has solicitado, puedes ignorar este correo.' }],
          tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
        }),
      });
      await response.body?.cancel();
      if (response.status !== 202) throw new VerificationDeliveryError();
    } catch { throw new VerificationDeliveryError(); }
  }
}
