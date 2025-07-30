import axios, { AxiosInstance } from 'axios';
import { Tenant } from '@shared/schema';

export interface PandaDocDocument {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  expiration_date?: string;
  version: string;
}

export interface CreateDocumentRequest {
  name: string;
  template_uuid: string;
  recipients: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    role: string;
  }>;
  tokens?: Array<{
    name: string;
    value: string;
  }>;
  fields?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CreateDocumentResponse {
  id: string;
  name: string;
  status: string;
  date_created: string;
  expiration_date?: string;
  version: string;
  uuid: string;
}

export class PandaDocService {
  private client: AxiosInstance;

  constructor(private tenant: Tenant) {
    // PandaDoc uses the same base URL for both sandbox and production
    // Sandbox is controlled by the API key itself
    const baseURL = 'https://api.pandadoc.com';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `API-Key ${tenant.pandaDocApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for better error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data?.detail) {
          error.message = error.response.data.detail;
        }
        return Promise.reject(error);
      }
    );
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    try {
      // Validate required fields
      if (!request.template_uuid) {
        throw new Error('Template UUID is required');
      }
      if (!request.recipients || request.recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }

      // Ensure recipients have required fields
      request.recipients.forEach((recipient, index) => {
        if (!recipient.email) {
          throw new Error(`Recipient ${index + 1} must have an email address`);
        }
        if (!recipient.role) {
          recipient.role = 'Signer'; // Default role
        }
      });

      // Add metadata for tenant identification in webhooks
      if (!request.metadata) {
        request.metadata = {};
      }
      request.metadata.tenant_id = this.tenant.id;

      const response = await this.client.post('/public/v1/documents', request);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message;
      throw new Error(`Failed to create PandaDoc document: ${errorMessage}`);
    }
  }

  async getDocument(documentId: string): Promise<PandaDocDocument> {
    try {
      const response = await this.client.get(`/public/v1/documents/${documentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch PandaDoc document: ${error.response?.data?.detail || error.message}`);
    }
  }

  async getDocumentDetails(documentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/public/v1/documents/${documentId}/details`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch PandaDoc document details: ${error.response?.data?.detail || error.message}`);
    }
  }

  async sendDocument(documentId: string, message?: string): Promise<any> {
    try {
      const response = await this.client.post(`/public/v1/documents/${documentId}/send`, {
        message: message || 'Please review and sign this document.',
        silent: false,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to send PandaDoc document: ${error.response?.data?.detail || error.message}`);
    }
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/public/v1/documents/${documentId}/download`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      throw new Error(`Failed to download PandaDoc document: ${error.response?.data?.detail || error.message}`);
    }
  }

  async getTemplates(): Promise<any[]> {
    try {
      const response = await this.client.get('/public/v1/templates');
      return response.data.results || [];
    } catch (error: any) {
      throw new Error(`Failed to fetch PandaDoc templates: ${error.response?.data?.detail || error.message}`);
    }
  }

  generatePublicLink(documentId: string): string {
    return `https://app.pandadoc.com/a/#/documents/${documentId}`;
  }
}
