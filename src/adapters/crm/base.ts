import type { LeadInfo } from '../../lib/conversation.js';
import type { CrmConfig } from '../../config/business.schema.js';

/**
 * Base CRM Adapter
 *
 * All CRM integrations (GoHighLevel, PaintScout, etc.) implement this interface.
 */

export interface CrmContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface CrmAppointment {
  id: string;
  contactId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  notes?: string;
}

export abstract class BaseCrmAdapter {
  protected config: CrmConfig;

  constructor(config: CrmConfig) {
    this.config = config;
  }

  /**
   * Create or update a contact from lead info
   */
  abstract upsertContact(lead: LeadInfo): Promise<CrmContact>;

  /**
   * Update contact status
   */
  abstract updateStatus(contactId: string, status: string): Promise<void>;

  /**
   * Add a note to the contact
   */
  abstract addNote(contactId: string, note: string): Promise<void>;

  /**
   * Log a conversation
   */
  abstract logConversation(
    contactId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void>;

  /**
   * Schedule an appointment
   */
  abstract scheduleAppointment(
    contactId: string,
    startTime: Date,
    durationMinutes: number,
    title: string,
    notes?: string
  ): Promise<CrmAppointment>;

  /**
   * Get contact by ID
   */
  abstract getContact(contactId: string): Promise<CrmContact | null>;

  /**
   * Search contacts
   */
  abstract searchContacts(query: string): Promise<CrmContact[]>;
}
