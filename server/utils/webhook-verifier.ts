import crypto from 'crypto';

export class WebhookVerifier {
  static verifyPandaDocSignature(payload: string, signature: string, secret: string): boolean {
    try {
      if (!signature || !secret) {
        console.warn('Missing webhook signature or secret');
        return false;
      }

      // PandaDoc uses HMAC-SHA256 for webhook signature verification
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // PandaDoc signatures are typically just the hex string without prefix
      const cleanSignature = signature.replace(/^sha256=/, '');
      
      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  static extractTenantFromPayload(payload: any): string | null {
    // Extract tenant ID from document metadata (added during document creation)
    if (payload.data?.metadata?.tenant_id) {
      return payload.data.metadata.tenant_id;
    }

    // Fallback: try to extract from document custom fields
    if (payload.data?.fields?.tenant_id?.value) {
      return payload.data.fields.tenant_id.value;
    }

    console.warn('Unable to extract tenant ID from webhook payload');
    return null;
  }

  static validateWebhookPayload(payload: any): boolean {
    try {
      // Basic payload structure validation
      if (!payload.event_type) {
        console.error('Webhook payload missing event_type');
        return false;
      }

      if (!payload.data) {
        console.error('Webhook payload missing data object');
        return false;
      }

      if (!payload.data.id) {
        console.error('Webhook payload missing document ID');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating webhook payload:', error);
      return false;
    }
  }
}
