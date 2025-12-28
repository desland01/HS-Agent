import { Router, type Request, type Response } from 'express';
import type { BusinessConfig } from '../config/business.schema.js';
import { AgentOrchestrator } from '../lib/orchestrator.js';
import { FacebookAdapter, type FacebookConfig } from '../adapters/platforms/index.js';

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
