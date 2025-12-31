import { Router, type Request, type Response } from 'express';
import type { BusinessConfig } from '../config/business.schema.js';
import { AgentOrchestrator } from '../lib/orchestrator.js';
import { FacebookAdapter, type FacebookConfig } from '../adapters/platforms/index.js';
import { getConversationByPhone, addMessage, updateLead } from '../lib/conversation.js';

/**
 * Create webhook routes for a business
 */
export function createWebhookRoutes(
  config: BusinessConfig,
  facebookConfig?: FacebookConfig
): Router {
  const router = Router();
  const orchestrator = new AgentOrchestrator(config);
  const facebook = facebookConfig ? new FacebookAdapter(facebookConfig) : null;

  /**
   * Web Chat - Start new conversation
   */
  router.post('/chat/start', async (req: Request, res: Response) => {
    try {
      const { name, email, phone, city, service } = req.body;

      const response = await orchestrator.handleNewLead('web', {
        name,
        email,
        phone,
        city,
        serviceInterest: service,
      });

      res.json({
        success: true,
        message: response.message,
        leadId: response.leadUpdates?.id,
      });
    } catch (error) {
      console.error('Chat start error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start conversation',
      });
    }
  });

  /**
   * Web Chat - Send message
   */
  router.post('/chat/message', async (req: Request, res: Response) => {
    try {
      const { leadId, message } = req.body;

      if (!leadId || !message) {
        return res.status(400).json({
          success: false,
          error: 'leadId and message are required',
        });
      }

      const response = await orchestrator.handleMessage(leadId, message, 'web');

      res.json({
        success: true,
        message: response.message,
      });
    } catch (error) {
      console.error('Chat message error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process message',
      });
    }
  });

  /**
   * Facebook Messenger - Webhook verification
   */
  router.get('/facebook/webhook', (req: Request, res: Response) => {
    if (!facebook) {
      return res.status(404).send('Facebook not configured');
    }

    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = facebook.verifyWebhook(mode, token, challenge);

    if (result) {
      res.status(200).send(result);
    } else {
      res.status(403).send('Verification failed');
    }
  });

  /**
   * Facebook Messenger - Incoming messages and events
   */
  router.post('/facebook/webhook', async (req: Request, res: Response) => {
    if (!facebook) {
      return res.status(404).send('Facebook not configured');
    }

    // Acknowledge immediately (Facebook requires <20s response)
    res.sendStatus(200);

    try {
      const { type, data } = facebook.parseWebhookEvent(req.body);

      if (type === 'message' && data) {
        const msg = data as import('../adapters/platforms/facebook.js').FacebookMessage;

        // Skip if no text message
        if (!msg.message?.text) return;

        // Show typing indicator
        await facebook.showTyping(msg.senderId, true);

        // Get user profile for name
        const profile = await facebook.getUserProfile(msg.senderId);
        const name = profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
          : undefined;

        // Process with agent
        const response = await orchestrator.handleMessage(
          msg.senderId,
          msg.message.text,
          'facebook'
        );

        // Send response
        await facebook.showTyping(msg.senderId, false);
        if (response.message) {
          await facebook.sendMessage(msg.senderId, response.message);
        }
      }

      if (type === 'lead' && data) {
        const lead = data as import('../adapters/platforms/facebook.js').FacebookLead;

        // Fetch full lead details
        const fullLead = await facebook.fetchLeadDetails(lead.leadId);

        if (fullLead) {
          const fields = facebook.parseLeadFields(fullLead.fields);

          // Create new lead in system
          const response = await orchestrator.handleNewLead('facebook', {
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            city: fields.city,
          });

          // If we have a way to message them (phone or Messenger), respond
          // Note: Lead ads don't provide Messenger ID, would need follow-up via email/SMS
          console.log('New FB lead:', fields, 'Response:', response.message);
        }
      }
    } catch (error) {
      console.error('Facebook webhook error:', error);
    }
  });

  /**
   * Lead form submission (from website)
   */
  router.post('/lead', async (req: Request, res: Response) => {
    try {
      const { name, email, phone, city, service, projectDetails, timeline, source } = req.body;

      const response = await orchestrator.handleNewLead(source || 'web', {
        name,
        email,
        phone,
        city,
        serviceInterest: service,
        projectDetails,
        timeline,
      });

      res.json({
        success: true,
        message: 'Thank you! We\'ll be in touch shortly.',
        agentMessage: response.message,
      });
    } catch (error) {
      console.error('Lead submission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit lead',
      });
    }
  });

  /**
   * Event trigger (for scheduled follow-ups, reminders)
   */
  router.post('/event', async (req: Request, res: Response) => {
    try {
      const { leadId, eventType, eventData } = req.body;

      const response = await orchestrator.handleEvent(leadId, eventType, eventData || {});

      res.json({
        success: true,
        message: response?.message || null,
      });
    } catch (error) {
      console.error('Event processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process event',
      });
    }
  });

  /**
   * iMessage - Inbound message webhook (from Cloud Mac)
   */
  router.post('/imessage/inbound', async (req: Request, res: Response) => {
    // Validate API key
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.IMESSAGE_WEBHOOK_SECRET;

    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { from, message, messageId, timestamp } = req.body;

      if (!from || !message) {
        return res.status(400).json({ error: 'from and message are required' });
      }

      // Find existing conversation by phone number
      const state = await getConversationByPhone(from);

      if (!state) {
        // No existing conversation - could create new one or ignore
        console.log(`[iMessage] Inbound from unknown number: ***-***-${from.slice(-4)}`);
        return res.json({
          success: true,
          action: 'ignored',
          reason: 'no_existing_conversation',
        });
      }

      // Add inbound message to conversation
      await addMessage(state.id, 'user', message);

      // Process through orchestrator
      const response = await orchestrator.handleMessage(state.leadId, message, 'sms');

      console.log(`[iMessage] Inbound processed for lead ${state.leadId}, response: ${response.message?.slice(0, 50)}...`);

      res.json({
        success: true,
        conversationId: state.id,
        leadId: state.leadId,
        responseMessage: response.message,
      });
    } catch (error) {
      console.error('[iMessage] Inbound webhook error:', error);
      res.status(500).json({ error: 'Failed to process inbound message' });
    }
  });

  /**
   * iMessage - Delivery status webhook (from Cloud Mac)
   */
  router.post('/imessage/status', async (req: Request, res: Response) => {
    // Validate API key
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.IMESSAGE_WEBHOOK_SECRET;

    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { messageId, status, to, timestamp, error } = req.body;

      console.log(`[iMessage] Status update: ${messageId} -> ${status}${error ? ` (${error})` : ''}`);

      // Could update CRM or internal tracking here
      // For now, just log it

      res.json({ success: true, received: true });
    } catch (error) {
      console.error('[iMessage] Status webhook error:', error);
      res.status(500).json({ error: 'Failed to process status update' });
    }
  });

  /**
   * Health check
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      business: config.businessName,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
