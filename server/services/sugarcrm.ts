import axios, { AxiosInstance } from 'axios';
import { Tenant } from '@shared/schema';

export interface SugarCRMField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface SugarCRMRecord {
  [key: string]: any;
}

export class SugarCRMService {
  private client: AxiosInstance;
  private accessToken?: string;

  constructor(private tenant: Tenant) {
    this.client = axios.create({
      baseURL: `${tenant.sugarCrmUrl}/api/rest/v10`,
      timeout: 30000,
    });
  }

  async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/oauth2/token', {
        grant_type: 'password',
        username: this.tenant.sugarCrmUsername,
        password: this.tenant.sugarCrmPassword,
        client_id: 'sugar',
        platform: 'api',
      });

      this.accessToken = response.data.access_token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    } catch (error) {
      throw new Error(`SugarCRM authentication failed: ${error}`);
    }
  }

  async getRecord(module: string, recordId: string): Promise<SugarCRMRecord> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const response = await this.client.get(`/${module}/${recordId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch ${module} record ${recordId}: ${error}`);
    }
  }

  async getModuleFields(module: string): Promise<SugarCRMField[]> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const response = await this.client.get(`/${module}/fields`);
      return Object.values(response.data).map((field: any) => ({
        name: field.name,
        label: field.vname || field.name,
        type: field.type,
        required: field.required || false,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch ${module} fields: ${error}`);
    }
  }

  async updateRecord(module: string, recordId: string, data: Partial<SugarCRMRecord>): Promise<SugarCRMRecord> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const response = await this.client.put(`/${module}/${recordId}`, data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update ${module} record ${recordId}: ${error}`);
    }
  }

  async createNote(module: string, recordId: string, subject: string, description?: string): Promise<any> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const noteData = {
        name: subject,
        description: description || '',
        parent_type: module,
        parent_id: recordId,
      };

      const response = await this.client.post('/Notes', noteData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create note: ${error}`);
    }
  }

  generateTokensFromRecord(record: SugarCRMRecord): Record<string, string> {
    const tokens: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && value !== undefined) {
        tokens[`{{${key}}}`] = String(value);
      }
    }

    return tokens;
  }
}
