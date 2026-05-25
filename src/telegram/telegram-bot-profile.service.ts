import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import {
  TELEGRAM_BOT_DESCRIPTION,
  TELEGRAM_BOT_SHORT_DESCRIPTION,
} from './telegram-bot-profile';

@Injectable()
export class TelegramBotProfileService {
  private readonly logger = new Logger(TelegramBotProfileService.name);

  /** Replace stale Russian EmNetwork BotFather text with English Obverse copy. */
  async syncEnglishProfile(bot: Telegraf): Promise<void> {
    const telegram = bot.telegram;

    await telegram.setMyShortDescription(TELEGRAM_BOT_SHORT_DESCRIPTION);
    await telegram.setMyDescription(TELEGRAM_BOT_DESCRIPTION);
    await telegram.setMyShortDescription(
      TELEGRAM_BOT_SHORT_DESCRIPTION,
      'en',
    );
    await telegram.setMyDescription(TELEGRAM_BOT_DESCRIPTION, 'en');
    await telegram.setMyShortDescription(
      TELEGRAM_BOT_SHORT_DESCRIPTION,
      'ru',
    );
    await telegram.setMyDescription(TELEGRAM_BOT_DESCRIPTION, 'ru');

    this.logger.log('Telegram bot profile synced to English');
  }
}
