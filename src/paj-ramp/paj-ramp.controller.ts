import {
  Controller,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import { PajiRampService } from './paj-ramp.service';
import { PajiRampSessionStore } from './session-store';
import { TelegramGateway } from '../telegram/telegram.gateway';

/**
 * PAJ Ramp webhook endpoint.
 * Receives order status updates and notifies users via Telegram.
 *
 * Status flow (from PAJ docs):
 *   INIT → PENDING_PAYMENT → PAID → PROCESSING → COMPLETED
 *   INIT → PENDING_PAYMENT → PAID → PROCESSING → FAILED
 *
 * For offramp:
 *   PENDING_TOKEN_TRANSFER → TOKEN_RECEIVED → PROCESSING → COMPLETED
 *
 * We only notify on key statuses to avoid spam.
 */
@Controller('webhook')
export class PajiRampWebhookController {
  private readonly logger = new Logger(PajiRampWebhookController.name);

  // Statuses that trigger a Telegram notification
  private readonly NOTIFY_STATUSES = new Set([
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'PAID',
    'TOKEN_RECEIVED',
  ]);

  constructor(
    private readonly pajRampService: PajiRampService,
    private readonly sessionStore: PajiRampSessionStore,
    private readonly telegramGateway: TelegramGateway,
  ) {}

  @Post('paj-ramp')
  async handleWebhook(
    @Body() body: PajiRampWebhookPayload,
  ): Promise<{ received: boolean }> {
    const { id: orderId, status } = body;
    this.logger.log(
      `PAJ webhook received: order=${orderId} status=${status} type=${body.transactionType}`,
    );

    // Always respond quickly — process async
    setImmediate(() => this.processWebhookAsync(body));

    return { received: true };
  }

  private async processWebhookAsync(body: PajiRampWebhookPayload): Promise<void> {
    const { id: orderId, status, transactionType, amount, fiatAmount, currency, errorMessage } = body;

    // Look up which Telegram user owns this order
    const telegramId = this.sessionStore.getTelegramIdByOrder(orderId);
    if (!telegramId) {
      this.logger.warn(`No user found for order ${orderId}`);
      return;
    }

    // Only notify on important statuses
    if (!this.NOTIFY_STATUSES.has(status)) {
      return;
    }

    const formattedFiat = `₦${new Intl.NumberFormat('en-NG').format(fiatAmount || 0)}`;
    const formattedCrypto = `${amount || 0} USDC`;
    let message = '';

    switch (status) {
      case 'COMPLETED':
        if (transactionType === 'ON_RAMP') {
          message =
            `🎉 *Onramp Complete!*\n\n` +
            `Order: \`${orderId}\`\n` +
            `You received: *${formattedCrypto}*\n` +
            `From: ${formattedFiat}\n\n` +
            `Your USDC is now in your wallet!`;
        } else {
          const bank = body.bank || '';
          const accNum = body.accountNumber
            ? `****${body.accountNumber.slice(-4)}`
            : '';
          message =
            `🎉 *Offramp Complete!*\n\n` +
            `Order: \`${orderId}\`\n` +
            `You sold: *${formattedCrypto}*\n` +
            `You received: ${formattedFiat}\n` +
            (bank ? `Sent to: ${bank} ${accNum}` : '');
        }
        break;

      case 'PAID':
        message =
          `💰 *Payment Received!*\n\n` +
          `Order: \`${orderId}\`\n` +
          `${formattedFiat} received.\n\n` +
          `Your USDC is being processed and will arrive shortly.`;
        break;

      case 'TOKEN_RECEIVED':
        message =
          `✅ *Tokens Received!*\n\n` +
          `Order: \`${orderId}\`\n` +
          `${formattedCrypto} received.\n\n` +
          `Your NGN is being sent to your bank.`;
        break;

      case 'FAILED':
        message =
          `❌ *Order Failed*\n\n` +
          `Order: \`${orderId}\`\n` +
          `${errorMessage ? `Reason: ${errorMessage}` : 'An error occurred.'}\n\n` +
          `Please try again with /buy or /sell.`;
        break;

      case 'CANCELLED':
        message =
          `🚫 *Order Cancelled*\n\n` +
          `Order: \`${orderId}\`\n\n` +
          `Please start a new order with /buy or /sell.`;
        break;
    }

    if (message) {
      try {
        await this.telegramGateway.sendNotification(telegramId, message);
        this.logger.log(`Telegram notification sent for order ${orderId} to user ${telegramId}`);
      } catch (err: any) {
        this.logger.error(`Failed to send Telegram notification: ${err.message}`);
      }
    }
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface PajiRampWebhookPayload {
  id: string;
  status: string;
  transactionType: 'ON_RAMP' | 'OFF_RAMP';
  amount?: number;
  fiatAmount?: number;
  currency?: string;
  rate?: number;
  fee?: number;
  mint?: string;
  recipient?: string;    // onramp: wallet that received
  address?: string;      // offramp: deposit address
  bank?: string;         // bank name
  accountNumber?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}