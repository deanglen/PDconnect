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
    signing_order?: number;
  }>;
  tokens?: Array<{
    name: string;
    value: string;
  }>;
  fields?: Record<string, any>;
  metadata?: Record<string, any>;
  folder_uuid?: string;
  tags?: string[];
  detect_title_variables?: boolean;
}

export interface SugarCRMDocumentRequest {
  tenantId: string;
  sugarRecordId: string;
  sugarModule: string;
  templateId?: string; // Optional - will use default template for module if not provided
  name?: string;
  recipients: Array<{
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    signing_order?: number;
  }>;
  tokens?: Array<{
    name: string;
    value: string;
  }>;
  fields?: Record<string, { value: string }>;
  tags?: string[];
  sendImmediately?: boolean;
  subject?: string;
  message?: string;
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
    console.log('[PandaDoc] Constructor received tenant:', {
      id: tenant.id,
      name: tenant.name,
      hasApiKey: !!tenant.pandaDocApiKey,
      apiKeyLength: tenant.pandaDocApiKey?.length || 0
    });
    
    // PandaDoc uses the same base URL for both sandbox and production
    // Sandbox is controlled by the API key itself
    const baseURL = 'https://api.pandadoc.com';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `API-Key ${tenant.pandaDocApiKey || tenant.panda_doc_api_key}`,
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

      console.log('[PandaDoc] Sending document creation request:', {
        url: '/public/v1/documents',
        method: 'POST',
        headers: {
          'Authorization': `API-Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(request, null, 2)
      });
      
      const response = await this.client.post('/public/v1/documents', request);
      return response.data;
    } catch (error: any) {
      console.error('[PandaDoc] Document creation error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        request: {
          name: request.name,
          template_uuid: request.template_uuid,
          recipients: request.recipients?.length,
          tokens: Object.keys(request.tokens || {}).length,
          fields: Object.keys(request.fields || {}).length
        }
      });
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          JSON.stringify(error.response?.data) || 
                          error.message;
      throw new Error(`Failed to create PandaDoc document: ${errorMessage}`);
    }
  }

  async createDocumentFromSugarCRM(
    request: SugarCRMDocumentRequest,
    sugarCrmData?: Record<string, any>
  ): Promise<CreateDocumentResponse & { publicUrl: string }> {
    try {
      // Build document name
      const documentName = request.name || this.buildDocumentName(sugarCrmData);
      
      // Prepare tokens with SugarCRM data
      const tokens = this.prepareTokens(request.tokens || [], sugarCrmData);
      
      // Prepare fields with SugarCRM data
      const fields = this.prepareFields(request.fields || {}, sugarCrmData);

      const createRequest: CreateDocumentRequest = {
        name: documentName,
        template_uuid: request.templateId || '',
        recipients: request.recipients,
        tokens,
        fields,
        tags: [...(request.tags || []), 'sugarcrm', request.sugarModule.toLowerCase()],
        detect_title_variables: true,
        metadata: {
          tenant_id: request.tenantId,
          sugar_record_id: request.sugarRecordId,
          sugar_module: request.sugarModule,
          created_from: 'sugarcrm'
        }
      };

      const response = await this.createDocument(createRequest);
      
      // Optionally send immediately
      if (request.sendImmediately) {
        // Wait for document to be ready (PandaDoc processing)
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.sendDocument(response.id, request.message);
      }

      return {
        ...response,
        publicUrl: this.generatePublicLink(response.id)
      };
    } catch (error: any) {
      throw new Error(`Failed to create document from SugarCRM: ${error.message}`);
    }
  }

  private buildDocumentName(sugarCrmData?: Record<string, any>): string {
    if (!sugarCrmData) {
      return `Document - ${new Date().toLocaleDateString()}`;
    }

    const name = sugarCrmData.name || sugarCrmData.first_name && sugarCrmData.last_name 
      ? `${sugarCrmData.first_name} ${sugarCrmData.last_name}` 
      : 'Document';
    
    return `${name} - ${new Date().toLocaleDateString()}`;
  }

  private prepareTokens(
    requestTokens: Array<{name: string, value: string}>,
    sugarCrmData?: Record<string, any>
  ): Array<{name: string, value: string}> {
    const tokens = [...requestTokens];
    
    if (sugarCrmData) {
      // Add common SugarCRM field mappings
      const commonMappings = [
        { token: 'RecordName', field: 'name' },
        { token: 'AccountName', field: 'account_name' },
        { token: 'FirstName', field: 'first_name' },
        { token: 'LastName', field: 'last_name' },
        { token: 'Email', field: 'email1' },
        { token: 'Phone', field: 'phone_work' },
        { token: 'Amount', field: 'amount' },
        { token: 'SalesStage', field: 'sales_stage' },
        { token: 'CloseDate', field: 'date_closed' }
      ];

      for (const mapping of commonMappings) {
        if (sugarCrmData[mapping.field] && !tokens.find(t => t.name === mapping.token)) {
          tokens.push({
            name: mapping.token,
            value: String(sugarCrmData[mapping.field])
          });
        }
      }
    }

    return tokens;
  }

  private prepareFields(
    requestFields: Record<string, { value: string }>,
    sugarCrmData?: Record<string, any>
  ): Record<string, any> {
    const fields = { ...requestFields };
    
    if (sugarCrmData) {
      // Pre-fill common form fields
      const fieldMappings = [
        { field: 'CustomerName', sugarField: 'name' },
        { field: 'CompanyName', sugarField: 'account_name' },
        { field: 'Email', sugarField: 'email1' },
        { field: 'Phone', sugarField: 'phone_work' },
        { field: 'Amount', sugarField: 'amount' },
        { field: 'Date', sugarField: 'date_closed' }
      ];

      for (const mapping of fieldMappings) {
        if (sugarCrmData[mapping.sugarField] && !fields[mapping.field]) {
          fields[mapping.field] = { value: String(sugarCrmData[mapping.sugarField]) };
        }
      }
    }

    return fields;
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
