import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  Length,
} from 'class-validator';
import { Chain, Currency } from 'paj_ramp';

export class CreateOfframpDto {
  @IsNumber()
  @Min(0.01)
  amount: number; // token amount to sell

  @IsString()
  mint: string; // token mint address

  @IsEnum(Chain)
  chain: Chain;

  @IsString()
  bank: string; // bank ID from getBanks

  @IsString()
  @Length(10, 10)
  accountNumber: string; // 10-digit Nigerian account number

  @IsEnum(Currency)
  currency: Currency;

  @IsOptional()
  @IsString()
  webhookURL?: string;

  @IsOptional()
  @IsNumber()
  fee?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class OfframpOrderResponseDto {
  id: string;
  address: string; // deposit address
  mint: string;
  amount: number; // exact token amount to send
  fiatAmount: number; // fiat amount user receives
  rate: number;
  fee: number;
  currency: string;
}