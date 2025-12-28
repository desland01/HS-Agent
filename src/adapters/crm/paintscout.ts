import { BaseCrmAdapter, type CrmContact, type CrmAppointment } from './base.js';
import type { LeadInfo } from '../../lib/conversation.js';

/**
 * PaintScout CRM Adapter
 *
 * Integrates with PaintScout via Zapier webhooks.
 * PaintScout doesn't have a direct API, so we use webhooks + Zapier.
 */
export class PaintScoutAdapter extends BaseCrmAdapter {
  /**
   * Send data to PaintScout via webhook (Zapier integration)
   */
  private async sendToWebhook(
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.webhookUrl) {
      console.warn('PaintScout webhook URL not configured');
      return;
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...data,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('PaintScout webhook error:', await response.text());
    }
  }

  async upsertContact(lead: LeadInfo): Promise<CrmContact> {
    // PaintScout contact creation via Zapier
    await this.sendToWebhook('create_contact', {
      first_name: lead.name?.split(' ')[0],
      last_name: lead.name?.split(' ').slice(1).join(' '),
      email: lead.email,
      phone: lead.phone,
      address: {
        city: lead.city,
      },
      notes: [
        `Service Interest: ${lead.serviceInterest}`,
        `Project Details: ${lead.projectDetails}`,
        `Timeline: ${lead.timeline}`,
        `Source: ${lead.source}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
    };
  }

  async updateStatus(contactId: string, status: string): Promise<void> {
    // Map status to PaintScout quote status
    const statusMap: Record<string, string> = {
      new: 'lead',
      contacted: 'contacted',
      qualified: 'qualified',
      appointment_scheduled: 'scheduled',
      estimate_sent: 'quote_sent',
      follow_up: 'follow_up',
      won: 'accepted',
      lost: 'declined',
    };

    await this.sendToWebhook('update_status', {
      contact_id: contactId,
      status: statusMap[status] || status,
    });
  }

  async addNote(contactId: string, note: string): Promise<void> {
    await this.sendToWebhook('add_note', {
      contact_id: contactId,
      note,
    });
  }

  async logConversation(
    contactId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void> {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.content}`)
      .join('\n\n');

    await this.addNote(contactId, `AI Conversation:\n\n${transcript}`);
  }

  async scheduleAppointment(
    contactId: string,
    startTime: Date,
    durationMinutes: number,
    title: string,
    notes?: string
  ): Promise<CrmAppointment> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    await this.sendToWebhook('schedule_appointment', {
      contact_id: contactId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      title,
      notes,
    });

    return {
      id: `apt_${Date.now()}`,
      contactId,
      startTime,
      endTime,
      title,
      notes,
    };
  }

  async getContact(contactId: string): Promise<CrmContact | null> {
    // PaintScout doesn't support direct contact lookup
    // Would need to implement via Zapier Tables or external database
    console.warn('PaintScout direct contact lookup not supported');
    return null;
  }

  async searchContacts(query: string): Promise<CrmContact[]> {
    // Would need external database for search
    console.warn('PaintScout contact search not supported');
    return [];
  }
}
