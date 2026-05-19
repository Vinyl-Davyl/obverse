import { Injectable } from '@nestjs/common';
import { PaymentLinksService } from 'src/payment-links/payment-links.service';
import { PaymentsService } from 'src/payments/payments.service';

type CreateInvoiceInput = {
  merchantId: string;
  amount: number;
  token: string;
  chain?: string;
  description?: string;
  customFields?: string[];
  isReusable: boolean;
};

@Injectable()
export class InvoiceApplicationService {
  constructor(
    private readonly paymentLinksService: PaymentLinksService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createInvoice(input: CreateInvoiceInput) {
    const customFields = (input.customFields || []).map((name) => ({
      fieldName: name,
      fieldType: name.includes('email') ? 'email' : 'text',
      required: true,
    }));

    const paymentLink = await this.paymentLinksService.createPaymentLink({
      merchantId: input.merchantId,
      amount: input.amount,
      token: input.token,
      chain: input.chain || 'solana',
      description: input.description,
      customFields,
      isReusable: input.isReusable,
    });

    return {
      paymentLink,
      paymentUrl: this.buildPaymentUrl(paymentLink.linkId),
      customFields,
    };
  }

  async listMerchantInvoices(merchantId: string, limit = 50) {
    return this.paymentLinksService.findByMerchantId(merchantId, limit);
  }

  async getMerchantInvoiceDetails(merchantId: string, linkId: string) {
    const link = await this.paymentLinksService.findByLinkId(linkId);

    if (link.merchantId.toString() !== merchantId) {
      return null;
    }

    const payments = await this.paymentsService.findByPaymentLinkId(
      link._id.toString(),
    );
    const confirmedPayments = payments.filter((payment) => {
      return payment.status === 'confirmed';
    });
    const totalAmount = confirmedPayments.reduce((sum, payment) => {
      return sum + payment.amount;
    }, 0);

    return {
      link,
      payments,
      confirmedPayments,
      totalAmount,
      paymentUrl: this.buildPaymentUrl(link.linkId),
    };
  }

  private buildPaymentUrl(linkId: string): string {
    const paymentBaseUrl = process.env.PAYMENT_URL
      ? process.env.PAYMENT_URL.replace(/\/$/, '')
      : process.env.APP_URL
        ? `${process.env.APP_URL.replace(/\/$/, '')}/pay`
        : 'https://pay.obverse.app';

    return `${paymentBaseUrl}/${linkId}`;
  }
}
