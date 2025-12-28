import { BaseCrmAdapter, type CrmContact, type CrmAppointment } from './base.js';
import type { LeadInfo } from '../../lib/conversation.js';

/**
 * GoHighLevel CRM Adapter
 *
 * Integrates with GHL via their API and webhooks.
 * Docs: https://highlevel.stoplight.io/docs/integrations
 */
export class GoHighLevelAdapter extends BaseCrmAdapter {
  private apiUrl = 'https://services.leadconnectorhq.com';

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GHL API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Send data to GHL webhook (for simpler integrations)
   */
  private async sendToWebhook(data: Record<string, unknown>): Promise<void> {
    if (!this.config.webhookUrl) {
      console.warn('GHL webhook URL not configured');
      return;
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('GHL webhook error:', await response.text());
    }
  }

  async upsertContact(lead: LeadInfo): Promise<CrmContact> {
    // Try webhook first (simpler, works with GHL automation triggers)
    if (this.config.webhookUrl && !this.config.apiKey) {
      await this.sendToWebhook({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        service: lead.serviceInterest,
        project_details: lead.projectDetails,
        timeline: lead.timeline,
        source: lead.source,
        status: lead.status,
        submitted_at: new Date().toISOString(),
      });

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
      };
    }

    // Use API if key is available
    if (this.config.apiKey) {
      // Search for existing contact first
      const existing = lead.email
        ? await this.searchContacts(lead.email)
        : lead.phone
        ? await this.searchContacts(lead.phone)
        : [];

      if (existing.length > 0) {
        // Update existing
        const contact = await this.request<{ contact: CrmContact }>(
          'PUT',
          `/contacts/${existing[0].id}`,
          {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            customFields: [
              { key: 'city', value: lead.city },
              { key: 'service_interest', value: lead.serviceInterest },
              { key: 'project_details', value: lead.projectDetails },
              { key: 'timeline', value: lead.timeline },
            ],
          }
        );
        return contact.contact;
      }

      // Create new contact
      const contact = await this.request<{ contact: CrmContact }>(
        'POST',
        '/contacts/',
        {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          customFields: [
            { key: 'city', value: lead.city },
            { key: 'service_interest', value: lead.serviceInterest },
            { key: 'project_details', value: lead.projectDetails },
            { key: 'timeline', value: lead.timeline },
          ],
        }
      );

      return contact.contact;
    }

    // Fallback: return minimal contact
    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
    };
  }

  async updateStatus(contactId: string, status: string): Promise<void> {
    // Map our status to GHL pipeline stages
    const pipelineStageMap: Record<string, string> = {
      new: 'New Lead',
      contacted: 'Contacted',
      qualified: 'Qualified',
      appointment_scheduled: 'Appointment Set',
      estimate_sent: 'Proposal Sent',
      follow_up: 'Follow Up',
      won: 'Closed Won',
      lost: 'Closed Lost',
    };

    if (this.config.webhookUrl) {
      await this.sendToWebhook({
        contact_id: contactId,
        status: pipelineStageMap[status] || status,
        updated_at: new Date().toISOString(),
      });
    }

    if (this.config.apiKey) {
      await this.request('PUT', `/contacts/${contactId}`, {
        tags: [status],
      });
    }
  }

  async addNote(contactId: string, note: string): Promise<void> {
    if (this.config.apiKey) {
      await this.request('POST', `/contacts/${contactId}/notes`, {
        body: note,
      });
    } else if (this.config.webhookUrl) {
      await this.sendToWebhook({
        contact_id: contactId,
        note,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async logConversation(
    contactId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void> {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.content}`)
      .join('\n\n');

    await this.addNote(contactId, `AI Conversation Log:\n\n${transcript}`);
  }

  async scheduleAppointment(
    contactId: string,
    startTime: Date,
    durationMinutes: number,
    title: string,
    notes?: string
  ): Promise<CrmAppointment> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    if (this.config.apiKey) {
      const result = await this.request<{ appointment: CrmAppointment }>(
        'POST',
        '/calendars/events',
        {
          contactId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          title,
          appointmentStatus: 'confirmed',
          notes,
        }
      );
      return result.appointment;
    }

    // Webhook fallback
    await this.sendToWebhook({
      type: 'appointment_scheduled',
      contact_id: contactId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
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
    if (!this.config.apiKey) return null;

    try {
      const result = await this.request<{ contact: CrmContact }>(
        'GET',
        `/contacts/${contactId}`
      );
      return result.contact;
    } catch {
      return null;
    }
  }

  async searchContacts(query: string): Promise<CrmContact[]> {
    if (!this.config.apiKey) return [];

    try {
      const result = await this.request<{ contacts: CrmContact[] }>(
        'GET',
        `/contacts/search?query=${encodeURIComponent(query)}`
      );
      return result.contacts;
    } catch {
      return [];
    }
  }
}
