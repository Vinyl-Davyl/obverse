import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { Chain, Currency } from 'paj_ramp';

export class CreateOnrampDto {
  @IsNumber()
  @Min(100) // Minimum fiat amount
  fiatAmount: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  recipient: string; // wallet address

  @IsString()
  mint: string; // token mint address

  @IsEnum(Chain)
  chain: Chain;

  @IsOptional()
  @IsString()
  webhookURL?: string;

  @IsOptional()
  @IsNumber()
  fee?: number;
}

export class OnrampOrderResponseDto {
  id: string;
  accountNumber: string;
  accountName: string;
  fiatAmount: number;
  bank: string;
  amount: number; // token amount received
  fee: number;
}