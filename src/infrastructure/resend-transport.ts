import { normalizeEmail } from '../domain/authentication.ts';

export type ResendConfiguration = Readonly<{
  apiKey: string | undefined;
  fromEmail: string | undefined;
  appEnvironment?: string;
  testMode?: boolean | string;
  testRecipientEmail?: string;
}>;

export class MailDeliveryError extends Error {
  constructor() { super('Mail delivery unavailable.'); this.name = 'MailDeliveryError'; }
}

export class ResendTransport {
  private readonly configuration: ResendConfiguration;
  private readonly sendRequest: typeof fetch;

  constructor(configuration: ResendConfiguration, sendRequest: typeof fetch = fetch.bind(globalThis)) {
    this.configuration = configuration;
    this.sendRequest = sendRequest;
  }

  async send(email: string, subject: string, text: string): Promise<void> {
    const { apiKey, fromEmail } = this.configuration;
    const environment = this.configuration.appEnvironment?.trim().toLowerCase();
    const testMode = this.configuration.testMode === true
      || (typeof this.configuration.testMode === 'string' && this.configuration.testMode.trim().toLowerCase() === 'true');
    const testRecipient = this.configuration.testRecipientEmail?.trim();
    if ((testMode || testRecipient) && environment !== 'development') throw new MailDeliveryError();
    if (testMode) return;
    if (!apiKey?.trim() || /[\r\n]/.test(apiKey) || !fromEmail) throw new MailDeliveryError();
    let from: string;
    try { from = normalizeEmail(fromEmail); } catch { throw new MailDeliveryError(); }

    let recipient = email;
    if (testRecipient) {
      try { recipient = normalizeEmail(testRecipient); } catch { throw new MailDeliveryError(); }
    }
    try { recipient = normalizeEmail(recipient); } catch { throw new MailDeliveryError(); }

    try {
      const response = await this.sendRequest('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject,
          text,
        }),
      });
      await response.body?.cancel();
      if (response.status !== 200 && response.status !== 201 && response.status !== 202) throw new MailDeliveryError();
    } catch {
      throw new MailDeliveryError();
    }
  }
}
