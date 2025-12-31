import type { BusinessConfig, TextingConfig } from '../../config/business.schema.js';
import {
  BaseChannel,
  type SendMessageOptions,
  type SendResult,
  type DeliveryStatus,
  type MessagePurpose,
  type SendStatus,
} from './base.js';
import { IMessageChannel } from './imessage.js';

// Re-export types
export type {
  SendMessageOptions,
  SendResult,
  DeliveryStatus,
  MessagePurpose,
  SendStatus,
};
export { BaseChannel };

/**
 * Create a channel adapter based on business config
 */
export function createChannel(config: TextingConfig): BaseChannel | null {
  if (!config.enabled) {
    return null;
  }

  switch (config.channel) {
    case 'imessage':
      return new IMessageChannel(config);
    case 'twilio':
      // TODO: Implement TwilioChannel
      console.warn('[Channels] Twilio channel not yet implemented');
      return null;
    case 'none':
    default:
      return null;
  }
}

/**
 * Convenience function to send a text message
 *
 * Handles channel creation and error handling in one call.
 * Returns null if texting is not configured.
 */
export async function sendText(
  config: BusinessConfig,
  options: SendMessageOptions
): Promise<SendResult | null> {
  if (!config.texting?.enabled) {
    console.log(`[sendText] Texting not enabled for ${config.businessName}`);
    return null;
  }

  const channel = createChannel(config.texting);
  if (!channel) {
    console.log(`[sendText] No channel configured for ${config.businessName}`);
    return null;
  }

  try {
    return await channel.send(options);
  } catch (error) {
    console.error(
      `[sendText] Unexpected error:`,
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
 * Check if a business has texting enabled
 */
export function hasTextingEnabled(config: BusinessConfig): boolean {
  return config.texting?.enabled === true && config.texting.channel !== 'none';
}

/**
 * Check if current time is within quiet hours for a business
 */
export function isQuietHours(config: BusinessConfig): boolean {
  if (!config.texting?.enabled) return false;

  const channel = createChannel(config.texting);
  return channel?.isQuietHours() ?? false;
}
