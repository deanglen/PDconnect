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
    const baseURL = tenant.pandaDocSandbox 
      ? 'https://api.pandadoc.com'
      : 'https://api.pandadoc.com';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `API-Key ${tenant.pandaDocApiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    try {
      const response = await this.client.post('/public/v1/documents', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create PandaDoc document: ${error.response?.data?.detail || error.message}`);
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
