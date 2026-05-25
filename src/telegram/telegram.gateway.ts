import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { StartHandler } from './handlers/start.handler';
import { CreateLinkHandler } from './handlers/create-link.handler';
import { ListLinksHandler } from './handlers/list-links.handler';
import { ViewLinkHandler } from './handlers/view-link.handler';
import { HelpHandler } from './handlers/help.handler';
import { WalletHandler } from './handlers/wallet.handler';
import { SettingsHandler } from './handlers/setting.handler';
import { TransactionsHandler } from './handlers/transactions.handler';
import { BalanceHandler } from './handlers/balance.handler';
import { SendHandler } from './handlers/send.handler';
import { DashboardHandler } from './handlers/dashboard.handler';
import { ConversationManager } from './conversation/conversation.manager';
import { ConfigService } from '@nestjs/config';
import { PajiRampBuyHandler } from '../paj-ramp/handlers/buy.handler';
import { PajiRampSellHandler } from '../paj-ramp/handlers/sell.handler';
import { PajiRampRateHandler } from '../paj-ramp/handlers/rate.handler';
import { PajiRampService } from '../paj-ramp/paj-ramp.service';
import { forwardRef } from '@nestjs/common';
import { TelegramBotProfileService } from './telegram-bot-profile.service';

@Injectable()
export class TelegramGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramGateway.name);
  private bot: Telegraf;

  constructor(
    private configService: ConfigService,
    private startHandler: StartHandler,
    private createLinkHandler: CreateLinkHandler,
    private listLinksHandler: ListLinksHandler,
    private viewLinkHandler: ViewLinkHandler,
    private helpHandler: HelpHandler,
    private walletHandler: WalletHandler,
    private settingsHandler: SettingsHandler,
    private transactionsHandler: TransactionsHandler,
    private balanceHandler: BalanceHandler,
    private sendHandler: SendHandler,
    private dashboardHandler: DashboardHandler,
    private conversationManager: ConversationManager,
    private pajRampBuyHandler: PajiRampBuyHandler,
    private pajRampSellHandler: PajiRampSellHandler,
    private pajRampRateHandler: PajiRampRateHandler,
    private pajRampService: PajiRampService,
    private telegramBotProfileService: TelegramBotProfileService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.logger.log(`Telegram Bot Token: ${token ? 'Loaded' : 'Not Loaded'}`);
    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
    this.bot = new Telegraf(token);
  }

  async onModuleInit() {
    try {
      await this.telegramBotProfileService.syncEnglishProfile(this.bot);

      this.registerCommands();
      this.registerMessageHandlers();

      // Add timeout to bot launch to prevent hanging
      const launchPromise = this.bot.launch();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Bot launch timeout after 10 seconds')),
          10000,
        ),
      );

      await Promise.race([launchPromise, timeoutPromise]);
      this.logger.log('Telegram bot started successfully');
    } catch (error) {
      this.logger.error(
        `Failed to start Telegram bot: ${error.message}`,
        error.stack,
      );
      this.logger.warn(
        'Server will continue without Telegram bot functionality',
      );
      // Don't throw - allow server to continue
    }
  }

  private registerCommands() {
    this.bot.command('start', async (ctx) => {
      try {
        await this.startHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /start command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('payment', async (ctx) => {
      try {
        await this.createLinkHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /payment command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('links', async (ctx) => {
      try {
        await this.listLinksHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /links command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('wallet', async (ctx) => {
      try {
        await this.walletHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /wallet command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('transactions', async (ctx) => {
      try {
        await this.transactionsHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /transactions command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('settings', async (ctx) => {
      try {
        await this.settingsHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /settings command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('help', async (ctx) => {
      try {
        await this.helpHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /help command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('balance', async (ctx) => {
      try {
        await this.balanceHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /balance command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('send', async (ctx) => {
      try {
        await this.sendHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /send command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('dashboard', async (ctx) => {
      try {
        await this.dashboardHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /dashboard command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('buy', async (ctx) => {
      try {
        await this.pajRampBuyHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /buy command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('sell', async (ctx) => {
      try {
        await this.pajRampSellHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /sell command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('rate', async (ctx) => {
      try {
        const args = ctx.message.text
          .replace('/rate', '')
          .trim()
          .split(/\s+/);
        await this.pajRampRateHandler.handle(ctx);
      } catch (error) {
        this.logger.error(
          `Error in /rate command: ${error.message}`,
          error.stack,
        );
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    this.bot.command('banks', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        if (!this.pajRampService.hasValidSession(telegramId)) {
          await ctx.reply(
            '🏦 *Supported Banks*\\n\\n' +
            'To see available banks, I need to verify your session first.\\n\\n' +
            'Send your email address:',
          );
          await this.conversationManager.setState(
            telegramId,
            new (require('mongoose').Types.ObjectId)(),
            'pajramp_list_banks',
            'asking_email',
            {},
          );
          return;
        }
        const banks = await this.pajRampService.listBanks(telegramId);
        const bankList = banks
          .slice(0, 15)
          .map((b, i) => `${i + 1}. *${b.name}* (${b.code})`)
          .join('\n');
        await ctx.reply(
          '🏦 *Supported Nigerian Banks*\\n\\n' +
            bankList + '\\n\\n' +
            (banks.length > 15 ? `...and ${banks.length - 15} more.` : '') + '\\n\\n' +
            'Use /sell to start selling USDC.',
          { parse_mode: 'Markdown' },
        );
      } catch (error) {
        this.logger.error(
          `Error in /banks command: ${error.message}`,
          error.stack,
        );
        await ctx.reply(`❌ ${error.message}`);
      }
    });
  }

  private registerMessageHandlers() {
    // Handle text messages based on conversation state
    this.bot.on('text', async (ctx) => {
      const telegramId = ctx.from.id.toString();

      try {
        const state = await this.conversationManager.getState(telegramId);

        if (!state) return; // No active conversation

        switch (state.currentCommand) {
          case 'start':
            if (state.currentStep === 'awaiting_wallet') {
              await this.startHandler.handleWalletInput(ctx, state);
            }
            break;

          case 'payment':
            if (state.currentStep === 'awaiting_custom_fields') {
              await this.createLinkHandler.handleCustomFieldsInput(ctx, state);
            } else if (state.currentStep === 'awaiting_amount') {
              await this.createLinkHandler.handleAmountInput(ctx, state);
            } else if (state.currentStep === 'awaiting_description') {
              await this.createLinkHandler.handleDescriptionInput(ctx, state);
            }
            break;

          case 'wallet':
            if (state.currentStep === 'awaiting_new_wallet') {
              await this.walletHandler.handleWalletInput(ctx, state);
            }
            break;

          case 'settings':
            if (state.currentStep === 'awaiting_webhook') {
              await this.settingsHandler.handleWebhookInput(ctx, state);
            } else if (state.currentStep === 'awaiting_default_fields') {
              await this.settingsHandler.handleDefaultFieldsInput(ctx, state);
            }
            break;

          case 'send':
            if (state.currentStep === 'awaiting_recipient') {
              await this.sendHandler.handleRecipientInput(ctx, state);
            } else if (state.currentStep === 'awaiting_amount') {
              await this.sendHandler.handleAmountInput(ctx, state);
            }
            break;

          // ─── PAJ Ramp onramp flow ───────────────────────────────
          case 'pajramp_buy':
            if (state.currentStep === 'asking_email') {
              await this.pajRampBuyHandler.handleEmailInput(ctx, state);
            } else if (state.currentStep === 'asking_otp') {
              await this.pajRampBuyHandler.handleOtpInput(ctx, state);
            } else if (state.currentStep === 'asking_amount') {
              await this.pajRampBuyHandler.handleAmountInput(ctx, state);
            } else if (state.currentStep === 'confirming') {
              await this.pajRampBuyHandler.handleConfirmation(ctx, state);
            }
            break;

          // ─── PAJ Ramp offramp flow ───────────────────────────────
          case 'pajramp_sell':
            if (state.currentStep === 'asking_email') {
              await this.pajRampSellHandler.handleEmailInput(ctx, state);
            } else if (state.currentStep === 'asking_otp') {
              await this.pajRampSellHandler.handleOtpInput(ctx, state);
            } else if (state.currentStep === 'asking_amount') {
              await this.pajRampSellHandler.handleAmountInput(ctx, state);
            } else if (state.currentStep === 'asking_bank') {
              await this.pajRampSellHandler.handleBankInput(ctx, state);
            } else if (state.currentStep === 'asking_account') {
              await this.pajRampSellHandler.handleAccountInput(ctx, state);
            }
            break;

          // ─── PAJ Ramp rate flow ───────────────────────────────
          case 'pajramp_rate':
            if (state.currentStep === 'asking_email') {
              await this.pajRampRateHandler.handleEmailInput(ctx, state);
            } else if (state.currentStep === 'asking_otp') {
              await this.pajRampRateHandler.handleOtpInput(ctx, state);
            }
            break;

          // ─── PAJ Ramp /banks email step ──────────────────────────
          case 'pajramp_list_banks':
            if (state.currentStep === 'asking_email') {
              await this.pajRampBuyHandler.handleEmailInput(ctx, state).then(
                async () => {
                  const tid = ctx.from.id.toString();
                  await this.conversationManager.updateState(tid, 'asking_otp', state.data);
                },
              );
            } else if (state.currentStep === 'asking_otp') {
              await this.pajRampBuyHandler.handleOtpInput(ctx, state).then(
                async () => {
                  const tid = ctx.from.id.toString();
                  const banks = await this.pajRampService.listBanks(tid);
                  const bankList = banks.slice(0, 15)
                    .map((b, i) => `${i + 1}. *${b.name}* (${b.code})`)
                    .join('\n');
                  await ctx.reply(
                    '🏦 *Supported Banks*\\n\\n' + bankList + '\\n\\nUse /sell to start selling USDC.',
                    { parse_mode: 'Markdown' },
                  );
                  await this.conversationManager.clearState(tid);
                },
              );
            }
            break;
        }
      } catch (error) {
        this.logger.error(
          `Error handling text message: ${error.message}`,
          error.stack,
        );
        try {
          await ctx.reply(
            '❌ Sorry, something went wrong processing your message. Please try again.',
          );
        } catch (replyError) {
          this.logger.error(
            `Failed to send error message: ${replyError.message}`,
          );
        }
      }
    });

    this.bot.on('callback_query', async (ctx) => {
      const telegramId = ctx.from.id.toString();

      try {
        // Type guard to check if callback query has data property
        const callbackQuery = ctx.callbackQuery;
        if (
          !('data' in callbackQuery) ||
          typeof callbackQuery.data !== 'string'
        ) {
          await ctx.answerCbQuery();
          return;
        }

        const data = callbackQuery.data;

        // Handle dashboard callbacks
        if (data.startsWith('dashboard:')) {
          await this.dashboardHandler.handleCallback(ctx);
          return;
        }

        // Handle send command callbacks
        if (data.startsWith('send_wallet:')) {
          await ctx.answerCbQuery();
          const walletAddress = data.replace('send_wallet:', '');
          await this.sendHandler.handleWalletSelection(ctx, walletAddress);
          return;
        }

        if (data.startsWith('send_token_type:')) {
          await ctx.answerCbQuery();
          const tokenType = data.replace('send_token_type:', '');
          await this.sendHandler.handleTokenTypeSelection(ctx, tokenType);
          return;
        }

        if (data === 'send_confirm') {
          await ctx.answerCbQuery();
          const state = await this.conversationManager.getState(telegramId);
          if (state) {
            await this.sendHandler.executeTransaction(ctx, state);
          }
          return;
        }

        if (data === 'send_cancel') {
          await ctx.answerCbQuery();
          await this.conversationManager.clearState(telegramId);
          await ctx.reply('❌ Transfer cancelled.');
          return;
        }

        // Handle view link callbacks (from list-links.handler.ts)
        if (data.startsWith('view:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('view:', '');
          await this.viewLinkHandler.handleCallback(ctx, linkId);
          return;
        }

        // Handle payments view callback
        if (data.startsWith('payments:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('payments:', '');
          await this.viewLinkHandler.showRecentPayments(ctx, linkId);
          return;
        }

        // Handle deactivate link callback
        if (data.startsWith('deactivate:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('deactivate:', '');
          await this.viewLinkHandler.handleDeactivate(ctx, linkId);
          return;
        }

        // Handle activate link callback
        if (data.startsWith('activate:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('activate:', '');
          await this.viewLinkHandler.handleActivate(ctx, linkId);
          return;
        }

        // Handle delete link callback
        if (data.startsWith('delete:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('delete:', '');
          await this.viewLinkHandler.handleDelete(ctx, linkId);
          return;
        }

        // Handle confirm delete callback
        if (data.startsWith('confirm_delete:')) {
          await ctx.answerCbQuery();
          const linkId = data.replace('confirm_delete:', '');
          await this.viewLinkHandler.handleConfirmDelete(ctx, linkId);
          return;
        }

        // Handle back to links callback
        if (data === 'back_to_links') {
          await ctx.answerCbQuery();
          await this.listLinksHandler.handle(ctx);
          return;
        }

        // Handle wallet callbacks
        if (data === 'update_wallet') {
          await ctx.answerCbQuery();
          await this.walletHandler.startWalletUpdate(ctx);
          return;
        }

        if (data === 'add_wallet') {
          await ctx.answerCbQuery();
          await this.walletHandler.startAddWallet(ctx);
          return;
        }

        if (data.startsWith('update_wallet_chain:')) {
          await ctx.answerCbQuery();
          const chain = data.replace('update_wallet_chain:', '');
          await this.walletHandler.handleWalletChainSelection(ctx, chain);
          return;
        }

        if (data.startsWith('add_wallet_chain:')) {
          await ctx.answerCbQuery();
          const chain = data.replace('add_wallet_chain:', '');
          await this.walletHandler.handleAddWalletChainSelection(ctx, chain);
          return;
        }

        if (data === 'cancel') {
          await ctx.answerCbQuery();
          await ctx.reply('❌ Action cancelled.');
          return;
        }

        // Handle settings callbacks
        if (data.startsWith('setting:')) {
          await ctx.answerCbQuery();
          const settingType = data.replace('setting:', '');
          if (settingType === 'token') {
            await this.settingsHandler.handleTokenChange(ctx);
          } else if (settingType === 'notifications') {
            await this.settingsHandler.toggleNotifications(ctx);
          } else if (settingType === 'webhook') {
            await this.settingsHandler.startWebhookSetup(ctx);
          } else if (settingType === 'fields') {
            await this.settingsHandler.startDefaultFieldsSetup(ctx);
          }
          return;
        }

        if (data.startsWith('token:')) {
          await ctx.answerCbQuery();
          const token = data.replace('token:', '');
          await this.settingsHandler.updateToken(ctx, token);
          return;
        }

        if (data === 'back_to_settings') {
          await ctx.answerCbQuery();
          await this.settingsHandler.handle(ctx);
          return;
        }

        if (data.startsWith('default_fields:')) {
          await ctx.answerCbQuery();
          const state = await this.conversationManager.getState(telegramId);
          if (state) {
            await this.settingsHandler.handleDefaultFieldsInput(ctx, state);
          }
          return;
        }

        // Handle transaction callbacks
        if (data.startsWith('tx_page:')) {
          await ctx.answerCbQuery();
          const page = parseInt(data.replace('tx_page:', ''));
          await this.transactionsHandler.handlePageChange(ctx, page);
          return;
        }

        if (data.startsWith('tx_filter:')) {
          await ctx.answerCbQuery();
          const type = data.replace('tx_filter:', '');
          await this.transactionsHandler.handleFilterChange(ctx, type);
          return;
        }

        if (data === 'tx_stats') {
          await ctx.answerCbQuery();
          await this.transactionsHandler.showStats(ctx);
          return;
        }

        if (data === 'tx_refresh') {
          await ctx.answerCbQuery();
          await this.transactionsHandler.handle(ctx);
          return;
        }

        // Handle create_new callback (doesn't require conversation state)
        if (data === 'create_new') {
          await ctx.answerCbQuery();
          await this.createLinkHandler.handle(ctx);
          return;
        }

        // Handle other callbacks that require conversation state
        const state = await this.conversationManager.getState(telegramId);
        if (!state) {
          await ctx.answerCbQuery();
          return;
        }

        if (data.startsWith('fields:')) {
          await this.createLinkHandler.handleCustomFieldsInput(ctx, state);
        } else if (data.startsWith('chain:')) {
          await this.createLinkHandler.handleChainSelection(ctx, state);
        } else if (data.startsWith('reusable:')) {
          await this.createLinkHandler.handleReusableInput(ctx, state);
        }
      } catch (error) {
        this.logger.error(
          `Error handling callback query: ${error.message}`,
          error.stack,
        );
        try {
          await ctx.answerCbQuery('❌ An error occurred. Please try again.');
          await ctx.reply(
            '❌ Sorry, something went wrong. Please try your request again.',
          );
        } catch (replyError) {
          this.logger.error(
            `Failed to send error message: ${replyError.message}`,
          );
        }
      }
    });
  }

  async sendNotification(telegramId: string, message: string) {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async onModuleDestroy() {
    console.log('Stopping Telegram bot...');
    await this.bot.stop();
    console.log('Telegram bot stopped');
  }
}

