import { Module } from '@nestjs/common';
import { MerchantsModule } from 'src/merchants/merchants.module';
import { PaymentLinksModule } from 'src/payment-links/payment-links.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { InvoiceApplicationService } from './invoice-application.service';
import { MerchantOnboardingService } from './merchant-onboarding.service';

@Module({
  imports: [MerchantsModule, PaymentLinksModule, PaymentsModule],
  providers: [MerchantOnboardingService, InvoiceApplicationService],
  exports: [MerchantOnboardingService, InvoiceApplicationService],
})
export class MessagingCoreModule {}
