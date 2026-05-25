import { Injectable } from '@nestjs/common';
import { InvoiceApplicationService } from 'src/messaging-core/invoice-application.service';
import { Context } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/types';
import { MerchantService } from 'src/merchants/merchants.service';

@Injectable()
export class ListLinksHandler {
  constructor(
    private invoiceApplicationService: InvoiceApplicationService,
    private merchantsService: MerchantService,
  ) {}

  async handle(ctx: Context) {
    // Answer callback query if this was triggered by a button
    if ('callback_query' in ctx.update && 'answerCbQuery' in ctx) {
      await ctx.answerCbQuery();
    }

    if (!ctx.from) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const telegramId = ctx.from.id.toString();
    const merchant = await this.merchantsService.findByTelegramId(telegramId);

    if (!merchant) {
      await ctx.reply(`⚠️ Please set up your account with /start`);
      return;
    }

    const links = await this.invoiceApplicationService.listMerchantInvoices(
      merchant._id.toString(),
      50,
    );

    if (links.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: '➕ Create Payment Link', callback_data: 'create_new' }],
        ],
      };

      await ctx.reply(
        `📭 You haven't created any payment links yet.\n\n` +
          `Use /payment to create your first payment link!`,
        { reply_markup: keyboard },
      );
      return;
    }

    const displayLimit = 10;
    const displayedLinks = links.slice(0, displayLimit);
    const hasMore = links.length > displayLimit;

    let message = `📊 Your Payment Links (${links.length} total):\n\nTap a link to view details:`;
    if (hasMore) {
      message += `\n\n⚠️ Showing ${displayLimit} most recent links`;
    }

    const buttons: InlineKeyboardButton[][] = displayedLinks.map((link) => {
      const status = link.isActive ? '✅' : '❌';
      const type = link.isReusable ? '🔄' : '1️⃣';
      const label = link.description || `${link.amount} ${link.token}`;

      // Ensure callback_data doesn't exceed 64 bytes limit
      const callbackData = `view:${link.linkId}`.slice(0, 64);

      return [
        {
          text: `${status} ${type} ${label.slice(0, 25)}`,
          callback_data: callbackData,
        },
      ];
    });

    // Add "Create New Link" button at the bottom
    buttons.push([{ text: '➕ Create New Link', callback_data: 'create_new' }]);

    try {
      await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (error) {
      console.error('Failed to send message with inline keyboard:', error);
      await ctx.reply('Sorry, something went wrong displaying your links.');
    }
  }
}
