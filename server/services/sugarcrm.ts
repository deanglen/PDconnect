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
  private refreshToken?: string;
  private tokenExpiry?: Date;

  constructor(private tenant: Tenant) {
    this.client = axios.create({
      baseURL: `${tenant.sugarCrmUrl}/rest/v11`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/oauth2/token', {
        grant_type: 'password',
        username: this.tenant.sugarCrmUsername,
        password: this.tenant.sugarCrmPassword,
        client_id: 'sugar',
        client_secret: '',
        platform: 'pandadoc_integration', // Custom platform to avoid conflicts
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      // Calculate expiry time (subtract 5 minutes as buffer)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
      
      // Use Bearer token for newer SugarCRM versions
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`SugarCRM authentication failed: ${errorMessage}`);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      await this.authenticate();
      return;
    }

    try {
      const response = await this.client.post('/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: 'sugar',
        client_secret: '',
        platform: 'pandadoc_integration',
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
      
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    } catch (error) {
      // If refresh fails, re-authenticate
      await this.authenticate();
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        await this.authenticate();
      }
    }
  }

  async getRecord(module: string, recordId: string): Promise<SugarCRMRecord> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get(`/${module}/${recordId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token expired, refresh and retry
        await this.refreshAccessToken();
        const retryResponse = await this.client.get(`/${module}/${recordId}`);
        return retryResponse.data;
      }
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to fetch ${module} record ${recordId}: ${errorMessage}`);
    }
  }

  async getModuleFields(module: string): Promise<SugarCRMField[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get(`/${module}/fields`);
      const fields = response.data.fields || response.data;
      return Object.values(fields).map((field: any) => ({
        name: field.name,
        label: field.vname || field.label || field.name,
        type: field.type,
        required: field.required || false,
      }));
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        const retryResponse = await this.client.get(`/${module}/fields`);
        const fields = retryResponse.data.fields || retryResponse.data;
        return Object.values(fields).map((field: any) => ({
          name: field.name,
          label: field.vname || field.label || field.name,
          type: field.type,
          required: field.required || false,
        }));
      }
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to fetch ${module} fields: ${errorMessage}`);
    }
  }

  async updateRecord(module: string, recordId: string, data: Partial<SugarCRMRecord>): Promise<SugarCRMRecord> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.put(`/${module}/${recordId}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        const retryResponse = await this.client.put(`/${module}/${recordId}`, data);
        return retryResponse.data;
      }
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to update ${module} record ${recordId}: ${errorMessage}`);
    }
  }

  async createNote(module: string, recordId: string, subject: string, description?: string): Promise<any> {
    await this.ensureAuthenticated();

    const noteData = {
      name: subject,
      description: description || '',
      parent_type: module,
      parent_id: recordId,
    };

    try {
      const response = await this.client.post('/Notes', noteData);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        const retryResponse = await this.client.post('/Notes', noteData);
        return retryResponse.data;
      }
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to create note: ${errorMessage}`);
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
