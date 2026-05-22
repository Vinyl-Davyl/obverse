import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeSDK,
  initiate,
  verify,
  createOnrampOrder,
  createOfframpOrder,
  getTransaction,
  getAllTransactions,
  getBanks,
  getTokenValue,
  getFiatValue,
  Environment,
  Chain,
  Currency,
} from 'paj_ramp';
import { PajiRampSessionStore } from './session-store';

/** Device signature for PAJ Ramp session verification */
interface DeviceSignature {
  uuid: string;
  device: string;
  os?: string;
  browser?: string;
  ip?: string;
}

export interface Bank {
  id: string;
  code: string;
  name: string;
  logo: string;
  country: string;
}

export interface PriceQuote {
  amount: number;
  mint: string;
  currency: string;
  fiatAmount?: number; // only for getFiatValue
}

export interface OnrampResult {
  id: string;
  accountNumber: string;
  accountName: string;
  fiatAmount: number;
  bank: string;
  amount: number;
  fee: number;
}

export interface OfframpResult {
  id: string;
  address: string;
  mint: string;
  amount: number;
  fiatAmount: number;
  rate: number;
  fee: number;
  currency: string;
}

@Injectable()
export class PajiRampService {
  private readonly logger = new Logger(PajiRampService.name);
  private initialized = false;

  // Default token mint addresses
  private readonly USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: PajiRampSessionStore,
  ) { }

  /**
   * Initialize the PAJ Ramp SDK on app startup
   */
  initialize(): void {
    if (this.initialized) return;

    const envVar = this.configService.get<string>('PAJ_ENVIRONMENT') || 'staging';
    const env =
      envVar === 'production'
        ? Environment.Production
        : Environment.Staging;

    initializeSDK(env);
    this.sessionStore.setEnvironment(env);
    this.initialized = true;
    this.logger.log(`PAJ Ramp SDK initialized: ${env}`);
  }

  /**
   * Get the API key from config
   */
  private getApiKey(): string {
    const apiKey = this.configService.get<string>('PAJ_API_KEY');
    if (!apiKey) {
      throw new UnauthorizedException('PAJ_API_KEY is not configured');
    }
    return apiKey;
  }

  /**
   * Get webhook URL from config
   */
  private getWebhookUrl(): string {
    return (
      this.configService.get<string>('PAJ_WEBHOOK_URL') ||
      this.configService.get<string>('APP_URL') + '/webhook/paj-ramp'
    );
  }

  /**
   * Build device info from a simple object (for Telegram context)
   */
  private buildDeviceInfo(): DeviceSignature {
    return {
      uuid: crypto.randomUUID(),
      device: 'Desktop',
      os: 'Linux',
      browser: undefined,
    };
  }

  // ─── SESSION MANAGEMENT ────────────────────────────────────────────────

  /**
   * Initiate a session — send OTP to the user's email.
   * The user must verify the OTP within 30 minutes.
   */
  async initiateSession(
    telegramId: string,
    email: string,
  ): Promise<{ email: string }> {
    try {
      const result = await initiate(email, this.getApiKey());
      this.sessionStore.setPendingEmail(telegramId, email);
      this.logger.log(`OTP initiated for ${email} (user: ${telegramId})`);
      return { email: result.email || email };
    } catch (error: any) {
      this.logger.error(`Failed to initiate session: ${error.message}`);
      throw new BadRequestException(
        `Failed to send OTP: ${error.message}`,
      );
    }
  }

  /**
   * Verify the OTP and upgrade the session to an authenticated token.
   * Returns true if successful.
   */
  async verifySession(
    telegramId: string,
    otp: string,
  ): Promise<boolean> {
    const session = this.sessionStore.get(telegramId);
    const email = session?.pendingEmail;

    if (!email) {
      throw new BadRequestException(
        'No pending OTP. Please start with /buy or /sell and enter your email first.',
      );
    }

    try {
      const result = await verify(
        email,
        otp,
        this.buildDeviceInfo(),
        this.getApiKey(),
      );

      this.sessionStore.setSessionToken(telegramId, result.token);
      this.logger.log(`Session verified for ${email} (user: ${telegramId})`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to verify OTP: ${error.message}`);
      throw new BadRequestException(
        `Invalid OTP: ${error.message}`,
      );
    }
  }

  /**
   * Ensure the user has a valid session. Throws if not.
   */
  requireSession(telegramId: string): string {
    const token = this.sessionStore.getSessionToken(telegramId);
    if (!token) {
      throw new UnauthorizedException(
        'Your session has expired. Please start a new transaction with /buy or /sell.',
      );
    }
    return token;
  }

  /**
   * Check if user has a valid session
   */
  hasValidSession(telegramId: string): boolean {
    return this.sessionStore.hasValidSession(telegramId);
  }

  /**
   * Clear user session (logout)
   */
  clearSession(telegramId: string): void {
    this.sessionStore.clear(telegramId);
    this.logger.log(`Session cleared for user ${telegramId}`);
  }

  // ─── PRICE QUOTES ──────────────────────────────────────────────────────

  /**
   * Convert fiat amount to token amount (onramp price quote).
   * Example: "How much USDC can I get for 50,000 NGN?"
   */
  async getOnrampQuote(
    telegramId: string,
    fiatAmount: number,
    currency: string = 'NGN',
    mint: string = this.USDC_SOLANA,
    chain: string = 'solana',
  ): Promise<PriceQuote> {
    const token = this.requireSession(telegramId);
    const currencyEnum = Currency[currency as keyof typeof Currency] || Currency.NGN;
    const chainEnum = chain === 'monad' ? Chain.MONAD : Chain.SOLANA;

    try {
      const result = await getTokenValue(
        { amount: fiatAmount, mint, currency: currencyEnum },
        token,
      );

      return {
        amount: result.amount ?? 0,
        mint: result.mint,
        currency: result.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get onramp quote: ${error.message}`);
      throw new BadRequestException(
        `Failed to get price quote: ${error.message}`,
      );
    }
  }

  /**
   * Convert token amount to fiat amount (offramp price quote).
   * Example: "How much NGN do I get for 10 USDC?"
   */
  async getOfframpQuote(
    telegramId: string,
    tokenAmount: number,
    currency: string = 'NGN',
    mint: string = this.USDC_SOLANA,
  ): Promise<PriceQuote> {
    const token = this.requireSession(telegramId);
    const currencyEnum = Currency[currency as keyof typeof Currency] || Currency.NGN;

    try {
      const result = await getFiatValue(
        { amount: tokenAmount, mint, currency: currencyEnum },
        token,
      );

      return {
        amount: result.amount ?? 0,
        mint: result.mint,
        currency: result.currency,
        fiatAmount: result.fiatAmount,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get offramp quote: ${error.message}`);
      throw new BadRequestException(
        `Failed to get price quote: ${error.message}`,
      );
    }
  }

  // ─── ONRAMP ───────────────────────────────────────────────────────────

  /**
   * Create an onramp order (buy crypto with bank transfer).
   * Returns the virtual account details the user must transfer to.
   */
  async createOnramp(
    telegramId: string,
    params: {
      fiatAmount: number;
      currency?: string;
      recipient: string;
      mint?: string;
      chain?: string;
      fee?: number;
    },
  ): Promise<OnrampResult> {
    const token = this.requireSession(telegramId);
    const currencyEnum = Currency[params.currency as keyof typeof Currency] || Currency.NGN;
    const chainEnum =
      (params.chain || 'solana') === 'monad' ? Chain.MONAD : Chain.SOLANA;
    const mint = params.mint || this.USDC_SOLANA;

    try {
      const order = await createOnrampOrder(
        {
          fiatAmount: params.fiatAmount,
          currency: currencyEnum,
          recipient: params.recipient,
          mint,
          chain: chainEnum,
          webhookURL: this.getWebhookUrl(),
          fee: params.fee,
        },
        token,
      );

      this.logger.log(
        `Onramp order ${order.id} created for user ${telegramId}: ${params.fiatAmount} ${params.currency} → ${order.amount} ${mint}`,
      );

      this.sessionStore.setOrderUser(order.id, telegramId);

      return {
        id: order.id,
        accountNumber: order.accountNumber,
        accountName: order.accountName,
        fiatAmount: order.fiatAmount,
        bank: order.bank,
        amount: order.amount,
        fee: order.fee,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create onramp order: ${error.message}`);
      throw new BadRequestException(
        `Failed to create order: ${error.message}`,
      );
    }
  }

  // ─── OFFRAMP ──────────────────────────────────────────────────────────

  /**
   * Get list of supported Nigerian banks
   */
  async listBanks(telegramId: string): Promise<Bank[]> {
    const token = this.requireSession(telegramId);

    try {
      const banks = await getBanks(token);
      return banks.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        logo: b.logo,
        country: b.country,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get banks: ${error.message}`);
      throw new BadRequestException(`Failed to get banks: ${error.message}`);
    }
  }

  /**
   * Create an offramp order (sell crypto for fiat to bank).
   * Returns the deposit address the user must send tokens to.
   */
  async createOfframp(
    telegramId: string,
    params: {
      amount: number;
      mint?: string;
      chain?: string;
      bankId: string;
      accountNumber: string;
      currency?: string;
      fee?: number;
      description?: string;
    },
  ): Promise<OfframpResult> {
    const token = this.requireSession(telegramId);
    const currencyEnum = Currency[params.currency as keyof typeof Currency] || Currency.NGN;
    const chainEnum =
      (params.chain || 'solana') === 'monad' ? Chain.MONAD : Chain.SOLANA;
    const mint = params.mint || this.USDC_SOLANA;

    try {
      const order = await createOfframpOrder(
        {
          amount: params.amount,
          mint,
          chain: chainEnum,
          bank: params.bankId,
          accountNumber: params.accountNumber,
          currency: currencyEnum,
          webhookURL: this.getWebhookUrl(),
          fee: params.fee,
          description: params.description,
        },
        token,
      );

      this.logger.log(
        `Offramp order ${order.id} created for user ${telegramId}: ${params.amount} ${mint} → ${order.fiatAmount} ${params.currency}`,
      );

      this.sessionStore.setOrderUser(order.id, telegramId);

      return {
        id: order.id,
        address: order.address,
        mint: order.mint,
        amount: order.amount,
        fiatAmount: order.fiatAmount,
        rate: order.rate,
        fee: order.fee,
        currency: order.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create offramp order: ${error.message}`);
      throw new BadRequestException(
        `Failed to create order: ${error.message}`,
      );
    }
  }

  // ─── TRANSACTIONS ─────────────────────────────────────────────────────

  /**
   * Get a specific transaction/order by ID
   */
  async getOrder(
    telegramId: string,
    orderId: string,
  ): Promise<any> {
    const token = this.requireSession(telegramId);
    try {
      return await getTransaction(token, orderId);
    } catch (error: any) {
      this.logger.error(`Failed to get transaction: ${error.message}`);
      throw new BadRequestException(
        `Failed to get transaction: ${error.message}`,
      );
    }
  }

  /**
   * Get all transactions for the current session
   */
  async getAllOrders(telegramId: string): Promise<any[]> {
    const token = this.requireSession(telegramId);
    try {
      return await getAllTransactions(token);
    } catch (error: any) {
      this.logger.error(`Failed to get transactions: ${error.message}`);
      throw new BadRequestException(
        `Failed to get transactions: ${error.message}`,
      );
    }
  }
}