import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { MerchantOnboardingService } from 'src/messaging-core/merchant-onboarding.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly client: WhatsAppClient | null = null;

  constructor(
    private readonly merchantOnboardingService: MerchantOnboardingService,
  ) {
    const apiKey = process.env.KAPSO_API_KEY;
    if (apiKey) {
      this.client = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: apiKey,
      });
    } else {
      this.logger.warn('KAPSO_API_KEY not set — outbound messages disabled');
    }
  }

  async processWebhookPayload(payload: any): Promise<void> {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        const contactMap = new Map<string, string>();

        for (const contact of contacts) {
          const waId = contact?.wa_id;
          const profileName = contact?.profile?.name;
          if (waId && profileName) {
            contactMap.set(waId, profileName);
          }
        }

        const messages = Array.isArray(value?.messages) ? value.messages : [];

        for (const message of messages) {
          await this.handleInboundMessage(message, contactMap);
        }
      }
    }
  }

  private async handleInboundMessage(
    message: any,
    contactMap: Map<string, string>,
  ): Promise<void> {
    const from = message?.from;
    const type = message?.type;

    if (!from || type !== 'text') {
      return;
    }

    const textBody = String(message?.text?.body || '').trim();
    if (!textBody) {
      return;
    }

    const normalized = textBody.toLowerCase();
    const profileName = contactMap.get(from);

    if (
      normalized === 'start' ||
      normalized === '/start' ||
      normalized === 'hi'
    ) {
      await this.handleStart(from, profileName);
      return;
    }

    if (normalized === 'help' || normalized === '/help') {
      await this.sendText(
        from,
        [
          'Obverse on WhatsApp (Phase 1)',
          '',
          'Available commands:',
          '- start: create/access your account',
          '- balance: show wallet addresses',
          '- help: show this message',
          '',
          'Coming next: payment links and invoices directly in WhatsApp.',
        ].join('\n'),
      );
      return;
    }

    if (normalized === 'balance' || normalized === '/balance') {
      await this.handleBalance(from, profileName);
      return;
    }

    await this.sendText(
      from,
      'I did not understand that yet. Send "help" to see available commands.',
    );
  }

  private async handleStart(from: string, profileName?: string): Promise<void> {
    const { wallet, isNew } =
      await this.merchantOnboardingService.onboardWhatsappMerchant({
        whatsappId: from,
        displayName: profileName,
      });

    await this.sendText(
      from,
      [
        isNew
          ? 'Welcome to Obverse on WhatsApp. Your account has been created.'
          : 'Welcome back to Obverse on WhatsApp.',
        '',
        `Solana: ${wallet?.solanaAddress || 'N/A'}`,
        `EVM: ${wallet?.ethereumAddress || 'N/A'}`,
        '',
        'Send "help" to see available commands.',
      ].join('\n'),
    );
  }

  private async handleBalance(
    from: string,
    profileName?: string,
  ): Promise<void> {
    const { wallet } =
      await this.merchantOnboardingService.onboardWhatsappMerchant({
        whatsappId: from,
        displayName: profileName,
      });

    await this.sendText(
      from,
      [
        'Your wallet addresses',
        `Solana: ${wallet?.solanaAddress || 'N/A'}`,
        `EVM (Monad/Base): ${wallet?.ethereumAddress || 'N/A'}`,
      ].join('\n'),
    );
  }

  private async sendText(to: string, body: string): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!this.client || !phoneNumberId) {
      this.logger.warn(
        `WhatsApp outbound not configured. Message to ${to}: ${body}`,
      );
      return;
    }

    try {
      await this.client.messages.sendText({ phoneNumberId, to, body });
    } catch (err: any) {
      this.logger.error(
        `Failed to send WhatsApp message to ${to}: ${err?.message ?? err}`,
      );
    }
  }
}
