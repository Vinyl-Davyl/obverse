import { Injectable } from '@nestjs/common';

@Injectable()
export class HelpHandler {
  async handle(ctx: any) {
    await ctx.reply(
      `🤖 *Obverse Bot Commands*\n\n` +
        `💰 *Payment Links*\n` +
        `/payment - Create a new payment link\n` +
        `/links - View all your payment links\n` +
        `/link <id> - View specific link details\n\n` +
        `💳 *Wallet & Balance*\n` +
        `/wallet - View/update your wallet\n` +
        `/balance - Check your wallet balances\n` +
        `/send - Send crypto to another wallet\n` +
        `/transactions - View transaction history\n\n` +
        `🏦 *Fiat Ramp (PAJ)*\n` +
        `/buy - Buy USDC with bank transfer (NGN → USDC)\n` +
        `/sell - Sell USDC for NGN (USDC → NGN)\n` +
        `/rate - Check current exchange rates\n` +
        `/banks - List supported Nigerian banks\n\n` +
        `⚙️ *Settings*\n` +
        `/settings - Configure bot settings\n` +
        `/dashboard - Open your merchant dashboard\n` +
        `/help - Show this help message\n\n` +
        `💡 Tip: Use /buy to purchase USDC or /sell to convert USDC to NGN!`,
      { parse_mode: 'Markdown' },
    );
  }
}