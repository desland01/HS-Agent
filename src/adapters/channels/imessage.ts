import type { TextingConfig } from '../../config/business.schema.js';
import {
  BaseChannel,
  type SendMessageOptions,
  type SendResult,
  type DeliveryStatus,
} from './base.js';
import { canSendTextToLead, formatRetryAfter } from '../../lib/rateLimiter.js';

/**
 * iMessage Channel Adapter
 *
 * Sends messages via Cloud Mac API endpoint.
 * Implements quiet hours, phone masking, and error handling.
 */

interface CloudMacResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class IMessageChannel extends BaseChannel {
  private endpoint: string;
  private apiKey: string;

  constructor(config: TextingConfig) {
    super(config);

    if (!config.imessageEndpoint) {
      throw new Error('iMessage endpoint URL is required');
    }
    if (!config.imessageApiKey) {
      throw new Error('iMessage API key is required');
    }

    this.endpoint = config.imessageEndpoint;
    this.apiKey = config.imessageApiKey;
  }

  /**
   * Send an iMessage via Cloud Mac
   */
  async send(options: SendMessageOptions): Promise<SendResult> {
    const { to, body, purpose, leadId, conversationId } = options;

    // Validate phone number
    if (!this.isValidPhone(to)) {
      console.error(`[iMessage] Invalid phone number: ${this.maskPhone(to)}`);
      return {
        status: 'error',
        error: 'Invalid phone number format',
        timestamp: new Date(),
      };
    }

    // Check rate limit if we have a leadId
    if (leadId) {
      const maxPerDay = this.config.rateLimits?.maxPerLeadPerDay ?? 3;
      const rateCheck = canSendTextToLead(leadId, maxPerDay);

      if (!rateCheck.allowed) {
        const retryAfter = formatRetryAfter(rateCheck.retryAfterMs || 0);
        console.log(
          `[iMessage] Rate limited for lead ${leadId}. Retry in ${retryAfter}`
        );
        return {
          status: 'rate_limited',
          error: `Rate limit exceeded. Retry in ${retryAfter}`,
          timestamp: new Date(),
        };
      }
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      const scheduledFor = this.getNextAllowedTime();
      console.log(
        `[iMessage] Quiet hours active. Message to ${this.maskPhone(to)} queued for ${scheduledFor.toISOString()}`
      );
      return {
        status: 'queued',
        scheduledFor,
        timestamp: new Date(),
      };
    }

    // Normalize phone number
    const normalizedPhone = this.normalizePhone(to);

    try {
      // Make request to Cloud Mac with 10 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message: body,
          metadata: {
            purpose,
            leadId,
            conversationId,
            ...options.metadata,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(
          `[iMessage] HTTP ${response.status} sending to ${this.maskPhone(to)}: ${errorText}`
        );
        return {
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date(),
        };
      }

      let data: CloudMacResponse;
      try {
        data = await response.json();
      } catch {
        console.error(`[iMessage] Invalid JSON response for ${this.maskPhone(to)}`);
        return {
          status: 'error',
          error: 'Invalid JSON response from Cloud Mac',
          timestamp: new Date(),
        };
      }

      if (data.success) {
        console.log(
          `[iMessage] Sent to ${this.maskPhone(to)}, purpose: ${purpose}, messageId: ${data.messageId || 'N/A'}`
        );
        return {
          status: 'sent',
          messageId: data.messageId,
          timestamp: new Date(),
        };
      } else {
        console.error(
          `[iMessage] Failed to send to ${this.maskPhone(to)}: ${data.error || 'Unknown error'}`
        );
        return {
          status: 'error',
          error: data.error || 'Send failed',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[iMessage] Timeout sending to ${this.maskPhone(to)}`);
        return {
          status: 'error',
          error: 'Request timeout (10s)',
          timestamp: new Date(),
        };
      }

      console.error(
        `[iMessage] Error sending to ${this.maskPhone(to)}:`,
        error instanceof Error ? error.message : error
      );
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get delivery status (stub - Cloud Mac may not support this yet)
   */
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    // TODO: Implement when Cloud Mac supports delivery status API
    console.log(`[iMessage] Delivery status check not implemented for: ${messageId}`);
    return null;
  }
}
