import type { CrmConfig } from '../../config/business.schema.js';
import { BaseCrmAdapter } from './base.js';
import { GoHighLevelAdapter } from './gohighlevel.js';
import { PaintScoutAdapter } from './paintscout.js';

export { BaseCrmAdapter, GoHighLevelAdapter, PaintScoutAdapter };
export type { CrmContact, CrmAppointment } from './base.js';

/**
 * CRM Adapter Factory
 *
 * Creates the right CRM adapter based on config.
 */
export function createCrmAdapter(config: CrmConfig): BaseCrmAdapter {
  switch (config.type) {
    case 'gohighlevel':
      return new GoHighLevelAdapter(config);
    case 'paintscout':
      return new PaintScoutAdapter(config);
    case 'pipedrive':
    case 'hubspot':
    case 'custom':
      // TODO: Implement these adapters
      console.warn(`CRM adapter for ${config.type} not yet implemented, using webhook fallback`);
      return new GoHighLevelAdapter(config); // Fallback to webhook-based
    default:
      throw new Error(`Unknown CRM type: ${config.type}`);
  }
}
