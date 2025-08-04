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
    // Handle both array format and single object format
    const webhookData = Array.isArray(payload) ? payload[0] : payload;
    
    // Extract tenant ID from document metadata (added during document creation)
    // Check for multiple possible tenant ID field formats
    const metadata = webhookData.data?.metadata;
    
    if (metadata) {
      // Standard tenant_id field
      if (metadata.tenant_id) {
        return metadata.tenant_id;
      }
      
      // Extended format from document creation process
      if (metadata.document__creation__user__tenant__id) {
        return metadata.document__creation__user__tenant__id;
      }
      
      // Alternative tenant field formats
      if (metadata.user_tenant_id) {
        return metadata.user_tenant_id;
      }
      
      if (metadata.creation_user_tenant_id) {
        return metadata.creation_user_tenant_id;
      }
    }

    // Fallback: try to extract from document custom fields
    if (webhookData.data?.fields?.tenant_id?.value) {
      return webhookData.data.fields.tenant_id.value;
    }

    // Additional fallback: try to extract from tokens if tenant info is stored there
    if (webhookData.data?.tokens) {
      const tenantToken = webhookData.data.tokens.find((token: any) => 
        token.name === 'TenantId' || token.name === 'tenant_id'
      );
      if (tenantToken?.value) {
        return tenantToken.value;
      }
    }

    console.warn('Unable to extract tenant ID from webhook payload');
    console.warn('Available metadata:', JSON.stringify(metadata, null, 2));
    console.warn('Available fields:', JSON.stringify(webhookData.data?.fields?.slice(0, 3), null, 2));
    return null;
  }

  static validateWebhookPayload(payload: any): boolean {
    try {
      // Handle both array format and single object format
      const webhookData = Array.isArray(payload) ? payload[0] : payload;
      
      // Basic payload structure validation - PandaDoc uses "event" not "event_type"
      if (!webhookData.event && !webhookData.event_type) {
        console.error('Webhook payload missing event or event_type field');
        return false;
      }

      if (!webhookData.data) {
        console.error('Webhook payload missing data object');
        return false;
      }

      if (!webhookData.data.id) {
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
