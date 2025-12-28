/**
 * Facebook Messenger & Lead Ads Adapter
 *
 * Handles:
 * 1. Messenger conversations (via Graph API)
 * 2. Lead form submissions (via Lead Ads webhooks)
 * 3. Instagram DMs (same API)
 */

export interface FacebookConfig {
  pageAccessToken: string;
  appSecret: string;
  verifyToken: string;
  pageId: string;
}

export interface FacebookMessage {
  senderId: string;
  recipientId: string;
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: { url?: string };
    }>;
  };
  postback?: {
    payload: string;
    title: string;
  };
}

export interface FacebookLead {
  leadId: string;
  formId: string;
  pageId: string;
  createdTime: string;
  fields: Array<{
    name: string;
    values: string[];
  }>;
}

export class FacebookAdapter {
  private config: FacebookConfig;
  private graphApiUrl = 'https://graph.facebook.com/v18.0';

  constructor(config: FacebookConfig) {
    this.config = config;
  }

  /**
   * Verify webhook subscription (for initial setup)
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string
  ): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse incoming webhook event
   */
  parseWebhookEvent(body: unknown): {
    type: 'message' | 'lead' | 'unknown';
    data: FacebookMessage | FacebookLead | null;
  } {
    const event = body as {
      object?: string;
      entry?: Array<{
        id: string;
        time: number;
        messaging?: FacebookMessage[];
        changes?: Array<{
          field: string;
          value: { leadgen_id: string; form_id: string; page_id: string; created_time: number };
        }>;
      }>;
    };

    if (event.object === 'page' && event.entry) {
      for (const entry of event.entry) {
        // Messenger message
        if (entry.messaging && entry.messaging.length > 0) {
          return { type: 'message', data: entry.messaging[0] };
        }

        // Lead form submission
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              return {
                type: 'lead',
                data: {
                  leadId: change.value.leadgen_id,
                  formId: change.value.form_id,
                  pageId: change.value.page_id,
                  createdTime: new Date(change.value.created_time * 1000).toISOString(),
                  fields: [], // Fetched separately
                },
              };
            }
          }
        }
      }
    }

    return { type: 'unknown', data: null };
  }

  /**
   * Fetch lead details from Lead Ads
   */
  async fetchLeadDetails(leadId: string): Promise<FacebookLead | null> {
    try {
      const response = await fetch(
        `${this.graphApiUrl}/${leadId}?access_token=${this.config.pageAccessToken}`
      );

      if (!response.ok) {
        console.error('Failed to fetch lead:', await response.text());
        return null;
      }

      const data = await response.json();
      return {
        leadId: data.id,
        formId: data.form_id,
        pageId: data.page_id,
        createdTime: data.created_time,
        fields: data.field_data || [],
      };
    } catch (error) {
      console.error('Error fetching lead details:', error);
      return null;
    }
  }

  /**
   * Send a text message via Messenger
   */
  async sendMessage(recipientId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.graphApiUrl}/me/messages?access_token=${this.config.pageAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
            messaging_type: 'RESPONSE',
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send message:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Send a message with quick reply buttons
   */
  async sendQuickReplies(
    recipientId: string,
    text: string,
    replies: Array<{ title: string; payload: string }>
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.graphApiUrl}/me/messages?access_token=${this.config.pageAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
              text,
              quick_replies: replies.map((r) => ({
                content_type: 'text',
                title: r.title,
                payload: r.payload,
              })),
            },
            messaging_type: 'RESPONSE',
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send quick replies:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending quick replies:', error);
      return false;
    }
  }

  /**
   * Mark message as seen
   */
  async markSeen(recipientId: string): Promise<void> {
    await fetch(
      `${this.graphApiUrl}/me/messages?access_token=${this.config.pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          sender_action: 'mark_seen',
        }),
      }
    );
  }

  /**
   * Show typing indicator
   */
  async showTyping(recipientId: string, on: boolean): Promise<void> {
    await fetch(
      `${this.graphApiUrl}/me/messages?access_token=${this.config.pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          sender_action: on ? 'typing_on' : 'typing_off',
        }),
      }
    );
  }

  /**
   * Get user profile info
   */
  async getUserProfile(userId: string): Promise<{
    firstName?: string;
    lastName?: string;
    profilePic?: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.graphApiUrl}/${userId}?fields=first_name,last_name,profile_pic&access_token=${this.config.pageAccessToken}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        firstName: data.first_name,
        lastName: data.last_name,
        profilePic: data.profile_pic,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract lead info from form fields
   */
  parseLeadFields(fields: Array<{ name: string; values: string[] }>): {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    [key: string]: string | undefined;
  } {
    const result: Record<string, string> = {};

    for (const field of fields) {
      const value = field.values[0];
      const name = field.name.toLowerCase();

      // Map common field names
      if (name.includes('name') || name === 'full_name') {
        result.name = value;
      } else if (name.includes('email')) {
        result.email = value;
      } else if (name.includes('phone') || name === 'phone_number') {
        result.phone = value;
      } else if (name.includes('city') || name.includes('location')) {
        result.city = value;
      } else {
        result[field.name] = value;
      }
    }

    return result;
  }
}
