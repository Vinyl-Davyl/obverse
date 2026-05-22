import {
  Module,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { PajiRampService } from './paj-ramp.service';
import { PajiRampWebhookController } from './paj-ramp.controller';
import { PajiRampSessionStore } from './session-store';
import { PajiRampBuyHandler } from './handlers/buy.handler';
import { PajiRampSellHandler } from './handlers/sell.handler';
import { PajiRampRateHandler } from './handlers/rate.handler';
import { WalletModule } from '../wallet/wallet.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    WalletModule,
    forwardRef(() => TelegramModule), // PajiRamp handlers use TelegramConversationManager
  ],
  providers: [
    PajiRampService,
    PajiRampSessionStore,
    PajiRampBuyHandler,
    PajiRampSellHandler,
    PajiRampRateHandler,
  ],
  controllers: [PajiRampWebhookController],
  exports: [
    PajiRampService,
    PajiRampSessionStore,
    PajiRampBuyHandler,
    PajiRampSellHandler,
    PajiRampRateHandler,
  ],
})
export class PajiRampModule implements OnModuleInit {
  constructor(private readonly pajRampService: PajiRampService) { }

  onModuleInit() {
    this.pajRampService.initialize();
  }
}