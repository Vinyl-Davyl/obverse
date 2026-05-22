import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PajiRampOrderDocument = PajiRampOrder & Document;

export enum PajiTransactionType {
  ON_RAMP = 'ON_RAMP',
  OFF_RAMP = 'OFF_RAMP',
}

export enum PajiOrderStatus {
  INIT = 'INIT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_TOKEN_TRANSFER = 'PENDING_TOKEN_TRANSFER',
  PAID = 'PAID',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  TOKEN_RECEIVED = 'TOKEN_RECEIVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class PajiRampOrder {
  /** Unique order ID from PAJ */
  @Prop({ required: true, unique: true, index: true })
  pajOrderId: string;

  /** Telegram user who created this order */
  @Prop({ required: true, index: true })
  telegramId: string;

  /** ON_RAMP or OFF_RAMP */
  @Prop({ required: true, enum: PajiTransactionType })
  transactionType: PajiTransactionType;

  /** Current PAJ status */
  @Prop({ required: true, enum: PajiOrderStatus })
  status: PajiOrderStatus;

  /** Crypto amount (USDC) */
  @Prop({ type: Number, default: 0 })
  amount: number;

  /** Fiat amount (NGN) */
  @Prop({ type: Number, default: 0 })
  fiatAmount: number;

  /** Currency (NGN) */
  @Prop({ default: 'NGN' })
  currency: string;

  /** Token mint address */
  @Prop()
  mint: string;

  /** Chain (SOLANA) */
  @Prop()
  chain: string;

  /** Rate applied */
  @Prop({ type: Number })
  rate: number;

  /** Fee charged */
  @Prop({ type: Number })
  fee: number;

  /** Virtual account number (onramp) */
  @Prop()
  accountNumber: string;

  /** Bank name (onramp) */
  @Prop()
  bankName: string;

  /** Deposit address (offramp) */
  @Prop()
  depositAddress: string;

  /** Recipient wallet address */
  @Prop()
  recipientAddress: string;

  /** Last status update from PAJ */
  @Prop({ type: Date })
  lastStatusUpdate: Date;
}

export const PajiRampOrderSchema = SchemaFactory.createForClass(PajiRampOrder);