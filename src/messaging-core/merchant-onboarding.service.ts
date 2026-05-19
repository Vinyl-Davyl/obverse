import { Injectable } from '@nestjs/common';
import { MerchantDocument } from 'src/merchants/schema/merchant.schema';
import { MerchantService } from 'src/merchants/merchants.service';

type TelegramOnboardingInput = {
  telegramId: string;
  username: string;
  firstName?: string;
  lastName?: string;
};

type WhatsAppOnboardingInput = {
  whatsappId: string;
  displayName?: string;
};

type OnboardingResult = {
  merchant: MerchantDocument;
  wallet: any;
  isNew: boolean;
};

@Injectable()
export class MerchantOnboardingService {
  constructor(private readonly merchantService: MerchantService) {}

  async onboardTelegramMerchant(
    input: TelegramOnboardingInput,
  ): Promise<OnboardingResult> {
    const existingMerchant = await this.merchantService.findByTelegramId(
      input.telegramId,
    );

    if (existingMerchant?.walletAddress) {
      await this.merchantService
        .upgradeWalletForEvm(input.telegramId)
        .catch(() => {
          // Best effort: onboarding should still succeed if EVM upgrade fails.
        });

      const refreshedMerchant = await this.merchantService.findByTelegramId(
        input.telegramId,
      );
      const wallet = await this.merchantService.getMerchantWithWallet(
        input.telegramId,
      );

      return {
        merchant: refreshedMerchant || existingMerchant,
        wallet: wallet?.wallet,
        isNew: false,
      };
    }

    const result = await this.merchantService.createMerchant(
      input.telegramId,
      input.username,
      input.firstName,
      input.lastName,
    );

    if (!result?.merchant || !result?.wallet) {
      throw new Error('Failed to create Telegram merchant');
    }

    return {
      merchant: result.merchant,
      wallet: result.wallet,
      isNew: true,
    };
  }

  async onboardWhatsappMerchant(
    input: WhatsAppOnboardingInput,
  ): Promise<OnboardingResult> {
    return this.merchantService.getOrCreateWhatsappMerchant(input);
  }
}
