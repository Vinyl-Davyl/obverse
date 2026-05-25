import { Injectable, Logger } from '@nestjs/common';
import { PajiRampService, Bank } from '../paj-ramp.service';
import { PajiRampSessionStore } from '../session-store';
import { ConversationManager } from '../../telegram/conversation/conversation.manager';
import { WalletService } from '../../wallet/services/wallet.service';

/**
 * /sell handler — Crypto-to-fiat (offramp) flow.
 *
 * Flow:
 *   /sell
 *   → Step: asking_email     — user sends their email
 *   → Step: asking_otp       — user sends OTP from email
 *   → Step: asking_amount   — user sends token amount (e.g. 10)
 *   → Step: asking_bank      — user selects bank number
 *   → Step: asking_account   — user sends account number
 *   → Done: order created, deposit address shown
 */
@Injectable()
export class PajiRampSellHandler {
  private readonly logger = new Logger(PajiRampSellHandler.name);

  constructor(
    private readonly pajRampService: PajiRampService,
    private readonly pajRampSessionStore: PajiRampSessionStore,
    private readonly conversationManager: ConversationManager,
    private readonly walletService: WalletService,
  ) {}

  async handle(ctx: any) {
    const telegramId = ctx.from.id.toString();

    await ctx.reply(
      '💸 *Sell Crypto for Fiat*\n\n' +
        "You'll send USDC and receive NGN in your Nigerian bank account.\n\n" +
        'What is your email address?\n' +
        '(An OTP will be sent to verify your identity)',
      { parse_mode: 'Markdown' },
    );

    await this.conversationManager.setState(
      telegramId,
      new (require('mongoose').Types.ObjectId)(),
      'pajramp_sell',
      'asking_email',
      {},
    );
  }

  /**
   * Handle email input
   */
  async handleEmailInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const email = ctx.message.text.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await ctx.reply('❌ Invalid email. Please enter a valid email:');
      return;
    }

    try {
      await ctx.reply('📧 Sending OTP to your email...');
      await this.pajRampService.initiateSession(telegramId, email);

      await this.conversationManager.updateState(telegramId, 'asking_otp', {
        email,
      });

      await ctx.reply(
        '✅ OTP sent!\n\n' + 'Check your email and enter the 4–6 digit code:',
      );
    } catch (error: any) {
      this.logger.error(`Sell email error: ${error.message}`);
      await ctx.reply(`❌ Failed to send OTP: ${error.message}`);
    }
  }

  /**
   * Handle OTP input
   */
  async handleOtpInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const otp = ctx.message.text.trim();

    if (!/^\d{4,6}$/.test(otp)) {
      await ctx.reply('❌ OTP must be 4–6 digits. Try again:');
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
          'How much USDC do you want to sell?\n\n' +
          'Enter the amount (e.g., 10, 50, 100)',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Sell OTP error: ${error.message}`);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  /**
   * Handle token amount — show quote and fetch banks
   */
  async handleAmountInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text.trim().replace(/[,]/g, '');

    const tokenAmount = parseFloat(text);

    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      await ctx.reply('❌ Invalid amount. Enter a positive number:');
      return;
    }

    try {
      // Get price quote
      const quote = await this.pajRampService.getOfframpQuote(
        telegramId,
        tokenAmount,
        'NGN',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );

      // Fetch supported banks
      const banks = await this.pajRampService.listBanks(telegramId);

      // Build bank list message (max 10 for inline display)
      const bankList = banks
        .slice(0, 10)
        .map((b, i) => `${i + 1}. ${b.name}`)
        .join('\n');

      const extra = banks.length > 10 ? `\n...and ${banks.length - 10} more banks.` : '';

      await this.conversationManager.updateState(telegramId, 'asking_bank', {
        ...state.data,
        email: state.data.email,
        sessionVerified: true,
        tokenAmount,
        fiatAmount: quote.fiatAmount,
        rate: (quote.fiatAmount ?? 0) / tokenAmount,
        banks: banks.slice(0, 10),
      });

      await ctx.reply(
        '💱 *Price Quote*\n\n' +
          `You sell: *${tokenAmount} USDC*\n` +
          `You receive: *₦${new Intl.NumberFormat('en-NG').format(quote.fiatAmount ?? 0)} NGN*\n` +
          `Rate: 1 USDC ≈ ₦${new Intl.NumberFormat('en-NG').format((quote.fiatAmount ?? 0) / tokenAmount)}\n\n` +
          `🏦 *Select Your Bank*\n\n` +
          `${bankList}${extra}\n\n` +
          'Reply with the *number* of your bank (e.g., 1, 2, 3)',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Sell amount error: ${error.message}`);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  /**
   * Handle bank selection — ask for account number
   */
  async handleBankInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text.trim();

    const bankIndex = parseInt(text) - 1;
    const banks: Bank[] = state.data.banks || [];

    if (isNaN(bankIndex) || bankIndex < 0 || bankIndex >= banks.length) {
      await ctx.reply(
        `❌ Invalid selection. Reply with a number from the list (1-${banks.length}):`,
      );
      return;
    }

    const selectedBank = banks[bankIndex];

    await this.conversationManager.updateState(
      telegramId,
      'asking_account',
      {
        ...state.data,
        selectedBank: {
          id: selectedBank.id,
          name: selectedBank.name,
          code: selectedBank.code,
        },
      },
    );

    await ctx.reply(
      `✅ *${selectedBank.name}*\n\n` +
        'Enter your 10-digit account number:',
      { parse_mode: 'Markdown' },
    );
  }

  /**
   * Handle account number — create the offramp order
   */
  async handleAccountInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const accountNumber = ctx.message.text.trim().replace(/\s/g, '');

    if (!/^\d{10}$/.test(accountNumber)) {
      await ctx.reply(
        '❌ Account number must be exactly 10 digits. Try again:',
      );
      return;
    }

    const { tokenAmount, selectedBank } = state.data;

    if (!selectedBank) {
      await ctx.reply(
        '❌ Session expired. Please start again with /sell.',
      );
      return;
    }

    try {
      await ctx.reply('⏳ Creating your order...');

      const order = await this.pajRampService.createOfframp(telegramId, {
        amount: tokenAmount,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        chain: 'solana',
        bankId: selectedBank.id,
        accountNumber,
        currency: 'NGN',
      });

      await this.conversationManager.clearState(telegramId);

      await ctx.reply(
        '✅ *Order Created!*\n\n' +
          `Order ID: \`${order.id}\`\n\n` +
          '📤 *Send Tokens*\n\n' +
          `Send *exactly ${order.amount} USDC* to this address:\n\n` +
          `\`\`\`${order.address}\`\`\`\n\n` +
          `Network: Solana\n\n` +
          '📥 *You Will Receive*\n' +
          `₦${new Intl.NumberFormat('en-NG').format(order.fiatAmount)} NGN\n` +
          `Bank: ${selectedBank.name}\n` +
          `Account: ****${accountNumber.slice(-4)}\n\n` +
          `Rate: 1 USDC ≈ ₦${new Intl.NumberFormat('en-NG').format(order.rate)}\n` +
          `Fee: ${order.fee} USDC\n\n` +
          '⚠️ Send *exactly* the amount shown. Your NGN will arrive within 5–15 mins after confirmation.',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Sell account error: ${error.message}`);
      await ctx.reply(`❌ Failed to create order: ${error.message}`);
    }
  }
}