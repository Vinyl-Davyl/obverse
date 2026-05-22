import { Injectable, Logger } from '@nestjs/common';
import { Environment } from 'paj_ramp';

export interface RampSession {
  userId: string;
  email?: string;
  sessionToken?: string;
  pendingEmail?: string; // email awaiting OTP verification
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * In-memory store for PAJ Ramp sessions and order-user mappings.
 *
 * Sessions track OTP verification state per Telegram user.
 * Order map tracks orderId → telegramId so the webhook can notify users.
 */
@Injectable()
export class PajiRampSessionStore {
  private readonly logger = new Logger(PajiRampSessionStore.name);

  // Map: telegramId → session
  private readonly sessions = new Map<string, RampSession>();

  // Map: pajOrderId → telegramId (for webhook lookups)
  private readonly orderMap = new Map<string, string>();

  private environment: Environment = Environment.Staging;

  setEnvironment(env: Environment) {
    this.environment = env;
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  getOrCreate(userId: string): RampSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = { userId, createdAt: new Date() };
      this.sessions.set(userId, session);
    }
    return session;
  }

  get(userId: string): RampSession | undefined {
    return this.sessions.get(userId);
  }

  setPendingEmail(userId: string, email: string): void {
    const session = this.getOrCreate(userId);
    session.pendingEmail = email;
    session.sessionToken = undefined;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  }

  setSessionToken(userId: string, token: string): void {
    const session = this.getOrCreate(userId);
    session.sessionToken = token;
    session.pendingEmail = undefined;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  }

  hasValidSession(userId: string): boolean {
    const session = this.sessions.get(userId);
    if (!session || !session.sessionToken) return false;
    if (session.expiresAt && session.expiresAt < new Date()) {
      this.sessions.delete(userId);
      return false;
    }
    return true;
  }

  getSessionToken(userId: string): string | undefined {
    const session = this.sessions.get(userId);
    if (
      !session ||
      !session.sessionToken ||
      (session.expiresAt && session.expiresAt < new Date())
    ) {
      return undefined;
    }
    return session.sessionToken;
  }

  clear(userId: string): void {
    this.sessions.delete(userId);
  }

  /**
   * Save a PAJ order ID linked to a Telegram user.
   * Called after order creation so the webhook can look up the user.
   */
  setOrderUser(orderId: string, telegramId: string): void {
    this.orderMap.set(orderId, telegramId);
    this.logger.debug(`Order ${orderId} → user ${telegramId}`);
  }

  /**
   * Get the Telegram user ID for a PAJ order.
   * Called by the webhook handler.
   */
  getTelegramIdByOrder(orderId: string): string | undefined {
    return this.orderMap.get(orderId);
  }

  cleanup(): number {
    const now = new Date();
    let cleaned = 0;
    for (const [userId, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.sessions.delete(userId);
        cleaned++;
      }
    }
    return cleaned;
  }
}