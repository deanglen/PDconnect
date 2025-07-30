import crypto from 'crypto';

export class WebhookVerifier {
  static verifyPandaDocSignature(payload: string, signature: string, secret: string): boolean {
    try {
      // PandaDoc uses HMAC-SHA256 for webhook signature verification
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // The signature might come with a prefix like "sha256="
      const cleanSignature = signature.replace('sha256=', '');
      
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
    // This would extract tenant ID from the payload
    // Implementation depends on how tenant identification is handled
    // Could be from document metadata, custom fields, etc.
    return payload.data?.metadata?.tenant_id || null;
  }
}
