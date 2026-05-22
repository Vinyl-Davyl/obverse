import { Injectable, Logger } from '@nestjs/common';
import { PajiRampService } from '../paj-ramp.service';
import { PajiRampSessionStore } from '../session-store';
import { ConversationManager } from '../../telegram/conversation/conversation.manager';
import { WalletService } from '../../wallet/services/wallet.service';

/**
 * /buy handler — Fiat-to-crypto (onramp) flow.
 *
 * Flow:
 *   /buy
 *   → Step: asking_email     — user sends their email
 *   → Step: asking_otp       — user sends OTP from email
 *   → Step: asking_amount   — user sends fiat amount (e.g. 50000)
 *   → Step: confirming       — user confirms the order
 *   → Done: order created, bank details shown
 */
@Injectable()
export class PajiRampBuyHandler {
  private readonly logger = new Logger(PajiRampBuyHandler.name);

  constructor(
    private readonly pajRampService: PajiRampService,
    private readonly conversationManager: ConversationManager,
    private readonly walletService: WalletService,
  ) { }

  async handle(ctx: any) {
    const telegramId = ctx.from.id.toString();

    await ctx.reply(
      '💰 *Buy Crypto with Bank Transfer*\n\n' +
      "You'll transfer NGN from your bank and receive USDC in your wallet.\n\n" +
      'What is your email address?\n' +
      '(An OTP will be sent to verify your identity)',
      { parse_mode: 'Markdown' },
    );

    await this.conversationManager.setState(
      telegramId,
      new (require('mongoose').Types.ObjectId)(), // placeholder
      'pajramp_buy',
      'asking_email',
      {},
    );
  }

  /**
   * Handle email input (first step)
   */
  async handleEmailInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const email = ctx.message.text.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await ctx.reply('❌ Invalid email address. Please enter a valid email:');
      return;
    }

    try {
      await ctx.reply('📧 Sending OTP to your email...');

      await this.pajRampService.initiateSession(telegramId, email);

      await this.conversationManager.updateState(telegramId, 'asking_otp', {
        email,
      });

      await ctx.reply(
        '✅ OTP sent!\n\n' +
        'Check your email and enter the 4–6 digit code:',
      );
    } catch (error: any) {
      this.logger.error(`Buy email error: ${error.message}`);
      await ctx.reply(
        `❌ Failed to send OTP: ${error.message}\n\n` +
        'Please try again with /buy or contact support.',
      );
    }
  }

  /**
   * Handle OTP input (second step)
   */
  async handleOtpInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const otp = ctx.message.text.trim();

    if (!/^\d{4,6}$/.test(otp)) {
      await ctx.reply('❌ OTP must be 4–6 digits. Please try again:');
      return;
    }

    try {
      await this.pajRampService.verifySession(telegramId, otp);

      await this.conversationManager.updateState(
        telegramId,
        'asking_amount',
        {
          ...state.data,
          email: state.data.email,
          sessionVerified: true,
        },
      );

      await ctx.reply(
        '✅ *Session verified!*\n\n' +
        'How much NGN do you want to spend?\n\n' +
        'Enter an amount (e.g., 10000, 50000, 100000)\n' +
        'Minimum: ₦100',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Buy OTP error: ${error.message}`);
      await ctx.reply(
        `❌ ${error.message}\n\n` +
        'Please enter the correct OTP or start again with /buy.',
      );
    }
  }

  /**
   * Handle fiat amount input (third step) — show quote + confirm
   */
  async handleAmountInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text.trim().replace(/[,₦]/g, '');

    const fiatAmount = parseFloat(text);

    if (isNaN(fiatAmount) || fiatAmount < 100) {
      await ctx.reply(
        '❌ Invalid amount. Please enter a number ≥ 100.\n' +
        'Example: 50000',
      );
      return;
    }

    try {
      // Get wallet address for the recipient
      const wallet = await this.walletService
        .getWalletByUserId(telegramId)
        .catch(() => null);

      const recipient = wallet?.solanaAddress || '';

      // Get onramp quote
      const quote = await this.pajRampService.getOnrampQuote(
        telegramId,
        fiatAmount,
        'NGN',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'solana',
      );

      await this.conversationManager.updateState(telegramId, 'confirming', {
        ...state.data,
        email: state.data.email,
        fiatAmount,
        tokenAmount: quote.amount,
        recipient,
        chain: 'solana',
      });

      await ctx.reply(
        '💱 *Price Quote*\n\n' +
        `You pay: *₦${new Intl.NumberFormat('en-NG').format(fiatAmount)} NGN*\n` +
        `You receive: *${quote.amount.toFixed(2)} USDC*\n` +
        `Rate: 1 USDC ≈ ${new Intl.NumberFormat('en-NG').format(fiatAmount / quote.amount)} NGN\n\n` +
        `Your wallet: \`${recipient ? recipient.slice(0, 8) + '...' + recipient.slice(-8) : 'N/A'}\`\n\n` +
        'Reply *yes* to confirm or *no* to cancel.',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Buy amount error: ${error.message}`);
      await ctx.reply(
        `❌ ${error.message}\n\n` +
        'Please try again with a different amount.',
      );
    }
  }

  /**
   * Handle confirmation (final step)
   */
  async handleConfirmation(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const response = ctx.message.text.trim().toLowerCase();

    if (response !== 'yes') {
      await this.conversationManager.clearState(telegramId);
      await ctx.reply('❌ Order cancelled.\n\nSend /buy to start again.');
      return;
    }

    const { fiatAmount, recipient, chain } = state.data;

    if (!recipient) {
      await ctx.reply(
        '❌ No wallet address found. Please set up your wallet with /start first.',
      );
      return;
    }

    try {
      await ctx.reply('⏳ Creating your order...');

      const order = await this.pajRampService.createOnramp(telegramId, {
        fiatAmount,
        currency: 'NGN',
        recipient,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        chain,
      });

      await this.conversationManager.clearState(telegramId);

      await ctx.reply(
        '✅ *Order Created!*\n\n' +
        `Order ID: \`${order.id}\`\n\n` +
        '🏦 *Transfer Details*\n\n' +
        `Bank: *${order.bank}*\n` +
        `Account Name: *${order.accountName}*\n` +
        `Account Number: \`${order.accountNumber}\`\n\n` +
        `Amount: *₦${new Intl.NumberFormat('en-NG').format(order.fiatAmount)} NGN*\n\n` +
        '📤 *You Will Receive*\n' +
        `${order.amount.toFixed(2)} USDC\n` +
        `(Fee: ₦${new Intl.NumberFormat('en-NG').format(order.fee)} NGN)\n\n` +
        '⚠️ Transfer *exactly* the amount shown above to the account details.\n' +
        'Your USDC will arrive in 5–15 minutes after the transfer is detected.',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Buy confirm error: ${error.message}`);
      await ctx.reply(
        `❌ Failed to create order: ${error.message}\n\n` +
        'Please try again with /buy.',
      );
    }
  }
}