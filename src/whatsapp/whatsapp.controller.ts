import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
    private readonly logger = new Logger(WhatsAppController.name);

    constructor(private readonly whatsAppService: WhatsAppService) { }

    @Get('webhook')
    @ApiOperation({
        summary: 'Verify WhatsApp webhook',
        description: 'Meta webhook verification callback for WhatsApp integration',
    })
    @ApiResponse({ status: 200, description: 'Webhook verified' })
    @ApiResponse({ status: 403, description: 'Verification failed' })
    verifyWebhook(
        @Query('hub.mode') mode?: string,
        @Query('hub.verify_token') verifyToken?: string,
        @Query('hub.challenge') challenge?: string,
    ): string {
        const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

        if (
            mode === 'subscribe' &&
            verifyToken &&
            expectedToken &&
            verifyToken === expectedToken
        ) {
            return challenge || '';
        }

        this.logger.warn('WhatsApp webhook verification failed');
        throw new ForbiddenException('Webhook verification failed');
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Receive WhatsApp webhook events',
        description: 'Receives inbound message events from Meta WhatsApp Cloud API',
    })
    @ApiResponse({ status: 200, description: 'Event received' })
    async handleWebhook(@Body() payload: any): Promise<{ received: boolean }> {
        const entries = Array.isArray(payload?.entry) ? payload.entry : [];
        const changes = entries.flatMap((entry: any) =>
            Array.isArray(entry?.changes) ? entry.changes : [],
        );
        const messages = changes.flatMap((change: any) =>
            Array.isArray(change?.value?.messages) ? change.value.messages : [],
        );
        const statuses = changes.flatMap((change: any) =>
            Array.isArray(change?.value?.statuses) ? change.value.statuses : [],
        );

        this.logger.log(
            `WhatsApp webhook received: entries=${entries.length}, changes=${changes.length}, messages=${messages.length}, statuses=${statuses.length}`,
        );

        await this.whatsAppService.processWebhookPayload(payload);
        return { received: true };
    }
}
