/**
 * Structured Logger with Pino
 *
 * Uses pino for high-performance JSON logging in production.
 * Pretty-prints in development for readability.
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'home-service-agent',
    version: '1.0.0',
  },
  // Redact sensitive fields
  redact: {
    paths: ['phone', 'email', 'apiKey', 'authorization', 'x-api-key'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log helper for agent operations
 */
export const agentLogger = createLogger({ module: 'agent' });

/**
 * Log helper for API operations
 */
export const apiLogger = createLogger({ module: 'api' });

/**
 * Log helper for CRM operations
 */
export const crmLogger = createLogger({ module: 'crm' });

/**
 * Log helper for messaging operations
 */
export const messagingLogger = createLogger({ module: 'messaging' });

export default logger;
