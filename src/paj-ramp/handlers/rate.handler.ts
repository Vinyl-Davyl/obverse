import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PajiRampService } from '../paj-ramp.service';
import { ConversationManager } from '../../telegram/conversation/conversation.manager';
import { Types } from 'mongoose';
/**
 * /rate handler — Quick exchange rate check.
 *
 * Flow (no session):
 *   /rate → asks for email
 *   → Step: asking_email  — user sends email → OTP sent
 *   → Step: asking_otp    — user sends OTP → rates shown
 *
 * Flow (session exists): direct to rates
 */
@Injectable()
export class PajiRampRateHandler {
  private readonly logger = new Logger(PajiRampRateHandler.name);

  constructor(
    private readonly pajRampService: PajiRampService,
    @Inject(forwardRef(() => ConversationManager))
    private readonly conversationManager: ConversationManager,
  ) {}

  async handle(ctx: any) {
    const telegramId = ctx.from.id.toString();

    if (!this.pajRampService.hasValidSession(telegramId)) {
      await ctx.reply(
        '📊 *Exchange Rates*\n\n' +
          'To check current rates, I need to verify your session first.\n\n' +
          'Send your email address:',
      );
      await this.conversationManager.setState(
        telegramId,
        new Types.ObjectId().toString(),  // placeholder — rate flow doesn't need merchantId
        'pajramp_rate',
        'asking_email',
        {},
      );
      return;
    }

    await this.showRates(ctx, telegramId);
  }

  /**
   * Handle email input for /rate flow
   */
  async handleEmailInput(ctx: any, state: any) {
    const telegramId = ctx.from.id.toString();
    const email = ctx.message.text.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await ctx.reply('❌ Invalid email. Please enter a valid email address:');
      return;
    }

    try {
      await ctx.reply('📧 Sending OTP to your email...');
      await this.pajRampService.initiateSession(telegramId, email);

      await this.conversationManager.updateState(telegramId, 'asking_otp', {
        ...state.data,
        email,
      });

      await ctx.reply(
        '✅ OTP sent!\n\n' +
          'Check your email and enter the 4–6 digit code:',
      );
    } catch (error: any) {
      this.logger.error(`Rate email error: ${error.message}`);
      await ctx.reply(`❌ Failed to send OTP: ${error.message}`);
    }
  }

  /**
   * Handle OTP input — verify then show rates
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
      await this.conversationManager.clearState(telegramId);
      await this.showRates(ctx, telegramId);
    } catch (error: any) {
      this.logger.error(`Rate OTP error: ${error.message}`);
      await ctx.reply(`❌ ${error.message}`);
    }
  }

  /**
   * Fetch and display current exchange rates
   */
  async showRates(ctx: any, telegramId: string) {
    try {
      const sampleFiat = 50000;

      const onrampQuote = await this.pajRampService.getOnrampQuote(
        telegramId,
        sampleFiat,
        'NGN',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'solana',
      );

      const offrampQuote = await this.pajRampService.getOfframpQuote(
        telegramId,
        10,
        'NGN',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );

      const onrampRate = (sampleFiat / onrampQuote.amount).toFixed(2);
      const offrampRate = ((offrampQuote.fiatAmount ?? 0) / 10).toFixed(2);

      await ctx.reply(
        '📊 *Current Exchange Rates*\n\n' +
          `Based on ₦${new Intl.NumberFormat('en-NG').format(sampleFiat)} NGN\n\n` +
          '🔵 *Onramp (Buy USDC)*\n' +
          `₦${new Intl.NumberFormat('en-NG').format(sampleFiat)} → *${onrampQuote.amount.toFixed(2)} USDC*\n` +
          `Rate: 1 USDC ≈ ₦${new Intl.NumberFormat('en-NG').format(Number(onrampRate))}\n\n` +
          '🔴 *Offramp (Sell USDC)*\n' +
          `10 USDC → *₦${new Intl.NumberFormat('en-NG').format(offrampQuote.fiatAmount ?? 0)} NGN*\n` +
          `Rate: 1 USDC ≈ ₦${new Intl.NumberFormat('en-NG').format(Number(offrampRate))}\n\n` +
          '_Rates are indicative and may change at order time._\n\n' +
          '/buy  — Buy USDC with bank transfer\n' +
          '/sell — Sell USDC for NGN',
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      this.logger.error(`Rate fetch error: ${error.message}`);
      await ctx.reply(`❌ ${error.message}`);
    }
  }
}