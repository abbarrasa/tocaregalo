import { normalizeEmail } from '../domain/authentication.ts';

export type SendgridConfiguration = Readonly<{ apiKey: string | undefined; fromEmail: string | undefined }>;

export class MailDeliveryError extends Error {
  constructor() { super('Mail delivery unavailable.'); this.name = 'MailDeliveryError'; }
}

export class SendgridTransport {
  private readonly configuration: SendgridConfiguration;
  private readonly sendRequest: typeof fetch;
  constructor(configuration: SendgridConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.configuration = configuration; this.sendRequest = sendRequest;
  }

  async send(email: string, subject: string, text: string): Promise<void> {
    const { apiKey, fromEmail } = this.configuration;
    if (!apiKey?.trim() || /[\r\n]/.test(apiKey) || !fromEmail) throw new MailDeliveryError();
    let from: string;
    try { from = normalizeEmail(fromEmail); } catch { throw new MailDeliveryError(); }
    try {
      const response = await this.sendRequest('https://api.sendgrid.com/v3/mail/send', {
        // Workers supports manual/follow; do not forward credentials to redirect targets.
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }], from: { email: from, name: 'TocaRegalo' }, subject,
          content: [{ type: 'text/plain', value: text }],
          tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
        }),
      });
      await response.body?.cancel();
      if (response.status !== 202) throw new MailDeliveryError();
    } catch { throw new MailDeliveryError(); }
  }
}
