import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKHQR } from '@manethpak/khqr-sdk';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

interface BakongMerchantConfig {
  bakongAccountId: string;
  merchantName: string;
  city: string;
  currency: string;
}

interface KHQRData {
  qrString: string;
  md5: string;
  amount: number;
  currency: string;
}

interface TransactionVerificationResponse {
  success: boolean;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED';
  transactionId?: string;
  amount?: number;
  timestamp?: Date;
}

@Injectable()
export class BakongGateway {
  private readonly logger = new Logger(BakongGateway.name);
  private readonly config: BakongMerchantConfig;
  private readonly paymentTimeoutMinutes: number;
  private readonly bakongApiUrl: string;
  private readonly bakongApiToken: string;

  constructor(private configService: ConfigService) {
    this.config = {
      bakongAccountId: this.configService.get<string>('BAKONG_ACCOUNT_ID', ''),
      merchantName: this.configService.get<string>(
        'BAKONG_MERCHANT_NAME',
        'My Store',
      ),
      city: this.configService.get<string>('BAKONG_CITY', 'Phnom Penh'),
      currency: this.configService.get<string>('BAKONG_CURRENCY', 'USD'),
    };

    this.paymentTimeoutMinutes = this.configService.get<number>(
      'BAKONG_PAYMENT_TIMEOUT_MINUTES',
      10,
    );

    this.bakongApiUrl = this.configService.get<string>(
      'BAKONG_API_URL',
      'https://api.bakong.nbc.gov.kh',
    );

    this.bakongApiToken = this.configService.get<string>(
      'BAKONG_API_TOKEN',
      '',
    );

    if (!this.config.bakongAccountId) {
      this.logger.warn(
        'BAKONG_ACCOUNT_ID not configured. KHQR payments will not work in production.',
      );
    }
  }

  /**
   * Generate KHQR data for a payment
   */
  generateKHQR(amount: number, currency: string = 'USD'): KHQRData {
    try {
      const khqr = createKHQR({
        baseURL: this.bakongApiUrl,
        authToken: this.bakongApiToken || undefined,
      });

      const { result, error } = khqr.qr.generateKHQR({
        bakongAccountID: this.config.bakongAccountId,
        merchantName: this.config.merchantName,
        merchantCity: this.config.city,
        currency: this.toSdkCurrency(currency),
        amount: amount,
        // A QR code with an amount is a dynamic one, it needs the moment when
        // it expires. The SDK expects the timestamp in milliseconds.
        expirationTimestamp: this.calculateExpiryTime().getTime(),
      });

      if (!result) {
        this.logger.error('Error generating KHQR:', error?.message);
        throw new Error(
          `Failed to generate KHQR payment data: ${error?.message ?? 'unknown error'}`,
        );
      }

      this.logger.log(`Generated KHQR for amount ${amount} ${currency}`);

      return {
        qrString: result.qr,
        // The SDK already computes the Bakong MD5 of the QR payload.
        md5: result.md5,
        amount: amount,
        currency: currency,
      };
    } catch (error) {
      this.logger.error('Error generating KHQR:', error);

      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to generate KHQR payment data',
      );
    }
  }

  /**
   * Convert amount from USD to KHR or vice versa
   * Conversion rate: 1 USD = 4000 KHR
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const conversionRate = 4000; // 1 USD = 4000 KHR

    if (fromCurrency === 'USD' && toCurrency === 'KHR') {
      return amount * conversionRate;
    } else if (fromCurrency === 'KHR' && toCurrency === 'USD') {
      return amount / conversionRate;
    }

    throw new Error(
      `Unsupported currency conversion from ${fromCurrency} to ${toCurrency}`,
    );
  }

  /**
   * The SDK only supports the KHR and USD currencies.
   */
  private toSdkCurrency(currency: string): 'KHR' | 'USD' {
    return currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD';
  }

  /**
   * Generate QR code image as base64 string
   */
  async generateQRCodeImage(qrString: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      // Remove the "data:image/png;base64," prefix if needed
      const base64Image = qrCodeDataURL.split(',')[1];
      return base64Image;
    } catch (error) {
      this.logger.error('Error generating QR code image:', error);
      throw new Error('Failed to generate QR code image');
    }
  }

  /**
   * Calculate payment expiry time
   */
  calculateExpiryTime(): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + this.paymentTimeoutMinutes);
    return expiry;
  }

  /**
   * Verify payment status with Bakong API
   * This is a placeholder implementation - actual API integration depends on
   * the official Bakong API documentation and your authorized access
   */
  async verifyPayment(
    md5: string,
    transactionHash?: string,
  ): Promise<TransactionVerificationResponse> {
    try {
      // In production, you would call the actual Bakong API here
      // The API endpoint and authentication method depend on your access level

      if (!this.bakongApiToken) {
        this.logger.warn(
          'BAKONG_API_TOKEN not configured. Payment verification will be simulated.',
        );
        return this.simulateVerification(md5);
      }

      // Example API call (adjust based on actual Bakong API documentation):
      // const response = await axios.post(
      //   `${this.bakongApiUrl}/v1/verify`,
      //   { md5, transactionHash },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${this.bakongApiToken}`,
      //       'Content-Type': 'application/json',
      //     },
      //   },
      // );

      // For now, return a simulated response
      return this.simulateVerification(md5);
    } catch (error) {
      this.logger.error('Error verifying payment with Bakong API:', error);
      throw new Error('Failed to verify payment status');
    }
  }

  /**
   * Simulate payment verification for testing purposes
   * In production, replace this with actual Bakong API calls
   */
  private simulateVerification(md5: string): TransactionVerificationResponse {
    // This is a placeholder - in production, you would call the actual Bakong API
    // The verification should check if the transaction was actually paid
    // using the MD5 hash or transaction hash

    this.logger.warn(
      'Using simulated payment verification. Configure BAKONG_API_TOKEN for production.',
    );

    return {
      success: false,
      status: 'PENDING',
    };
  }

  /**
   * Check if payment has expired
   */
  isPaymentExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Validate KHQR data integrity
   */
  validateKHQRData(qrString: string, expectedMd5: string): boolean {
    const calculatedMd5 = crypto
      .createHash('md5')
      .update(qrString)
      .digest('hex');
    return calculatedMd5 === expectedMd5;
  }
}
