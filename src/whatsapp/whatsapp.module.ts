import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MessagingCoreModule } from 'src/messaging-core/messaging-core.module';

@Module({
    imports: [MessagingCoreModule],
    controllers: [WhatsAppController],
    providers: [WhatsAppService],
})
export class WhatsAppModule { }
