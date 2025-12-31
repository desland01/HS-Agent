import type { TextingConfig } from '../../config/business.schema.js';

/**
 * Channel Adapter Base Class
 *
 * Abstract base for SMS/iMessage channels with common functionality:
 * - Quiet hours enforcement
 * - Phone number masking for logs
 * - Standardized send/status interfaces
 */

export type MessagePurpose = 'transactional' | 'marketing' | 'reminder' | 'followup';

export type SendStatus = 'sent' | 'queued' | 'rate_limited' | 'no_consent' | 'error';

export interface SendMessageOptions {
  to: string;
  body: string;
  purpose: MessagePurpose;
  leadId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  status: SendStatus;
  messageId?: string;
  scheduledFor?: Date; // If queued due to quiet hours
  error?: string;
  timestamp: Date;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'delivered' | 'read' | 'failed' | 'pending';
  timestamp: Date;
  error?: string;
}

export abstract class BaseChannel {
  protected config: TextingConfig;

  constructor(config: TextingConfig) {
    this.config = config;
  }

  /**
   * Send a message through this channel
   */
  abstract send(options: SendMessageOptions): Promise<SendResult>;

  /**
   * Get delivery status for a message (if supported)
   */
  abstract getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null>;

  /**
   * Check if current time is within quiet hours
   */
  isQuietHours(): boolean {
    if (!this.config.quietHours?.enabled) return false;

    const { start, end } = this.config.quietHours;
    const timezone = this.config.timezone || 'America/New_York';

    // Get current hour in business timezone
    const now = new Date();
    const hour = parseInt(
      now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    );

    // Quiet hours can span midnight (e.g., 20:00 to 08:00)
    if (start > end) {
      // Spans midnight: quiet from start PM to end AM
      return hour >= start || hour < end;
    } else {
      // Same day: quiet from start to end
      return hour >= start && hour < end;
    }
  }

  /**
   * Get the next allowed send time (after quiet hours end)
   */
  getNextAllowedTime(): Date {
    if (!this.config.quietHours?.enabled) return new Date();

    const { end } = this.config.quietHours;
    const timezone = this.config.timezone || 'America/New_York';

    // Get current date in business timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(now).split('/');

    // Create date for end of quiet hours today
    const nextTime = new Date(`${year}-${month}-${day}T${end.toString().padStart(2, '0')}:00:00`);

    // If we're past that time today, add a day
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return `***-***-${digits.slice(-4)}`;
  }

  /**
   * Validate phone number format
   */
  protected isValidPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    // US phone numbers: 10 digits, or 11 with country code
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  }

  /**
   * Normalize phone to E.164 format
   */
  protected normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return phone; // Return as-is if unknown format
  }
}
