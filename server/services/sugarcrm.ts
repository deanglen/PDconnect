import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { Tenant } from '@shared/schema';
import { moduleSchemas, mockRecords } from '../mock-data/sugarcrm-schemas';

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
  private identityClient: AxiosInstance;
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
      // For development/demo - in production you'd want proper SSL validation
      httpsAgent: process.env.NODE_ENV === 'development' ? new https.Agent({
        rejectUnauthorized: false
      }) : undefined,
    });
    
    // For SugarCRM Cloud, we also need the identity service client
    this.identityClient = axios.create({
      baseURL: 'https://login-us-west-2.service.sugarcrm.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<void> {
    try {
      console.log(`[SugarCRM] Attempting authentication for ${this.tenant.sugarCrmUsername} at ${this.tenant.sugarCrmUrl}`);
      
      let response;
      const authMethods = [
        // Method 1: Basic OAuth2 without platform
        {
          client: this.client,
          endpoint: '/oauth2/token',
          data: {
            grant_type: 'password',
            username: this.tenant.sugarCrmUsername,
            password: this.tenant.sugarCrmPassword,
            client_id: 'sugar',
            client_secret: '',
          }
        },
        // Method 2: SugarCRM Cloud Identity Service
        {
          client: this.identityClient,
          endpoint: '/oauth2/token',
          data: {
            grant_type: 'password',
            username: this.tenant.sugarCrmUsername,
            password: this.tenant.sugarCrmPassword,
            client_id: 'sugar',
            scope: 'https://apis.sugarcrm.com/auth/crm',
          }
        }
      ];

      let lastError;
      for (const method of authMethods) {
        try {
          console.log(`[SugarCRM] Trying ${method.endpoint} with ${method.client === this.identityClient ? 'Identity Service' : 'Direct Instance'}...`);
          response = await method.client.post(method.endpoint, method.data);
          console.log(`[SugarCRM] Authentication successful with ${method.endpoint}`);
          break;
        } catch (error: any) {
          lastError = error;
          console.log(`[SugarCRM] ${method.endpoint} failed: ${error.response?.data?.error_message || error.message}`);
        }
      }

      if (!response) {
        throw lastError;
      }

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
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
      
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`SugarCRM token refresh failed: ${errorMessage}`);
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureAuthenticated();
      
      // Test by getting the current user info
      const response = await this.client.get('/me');
      
      return {
        success: true,
        message: `Connected successfully. User: ${response.data.user_name || 'Unknown'}`
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error_message || error.message;
      return {
        success: false,
        message: `Connection failed: ${errorMessage}`
      };
    }
  }

  async getRecord(module: string, recordId: string): Promise<SugarCRMRecord> {
    // Try real API first, fallback to mock data if API fails
    try {
      await this.ensureAuthenticated();
      const response = await this.client.get(`/${module}/${recordId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token expired, refresh and retry
        await this.refreshAccessToken();
        const retryResponse = await this.client.get(`/${module}/${recordId}`);
        return retryResponse.data;
      }
      
      // Fallback to mock data in development if API fails
      if (process.env.NODE_ENV === 'development' && mockRecords[module]?.[recordId]) {
        console.log(`[Fallback] Using mock data for ${module} record ${recordId}`);
        return mockRecords[module][recordId];
      }
      
      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to fetch ${module} record ${recordId}: ${errorMessage}`);
    }
  }

  async getRecords(module: string, limit: number = 10): Promise<any[]> {
    try {
      console.log(`[SugarCRM] Fetching ${limit} records from ${module} module`);
      
      await this.ensureAuthenticated();
      
      const response = await this.client.get(`/${module}`, {
        params: {
          max_num: limit,
          offset: 0,
          fields: 'id,name,date_entered,date_modified'
        }
      });

      console.log(`[SugarCRM] Retrieved ${response.data.records?.length || 0} records from ${module}`);
      return response.data.records || [];
    } catch (error: any) {
      console.error(`[SugarCRM] Error fetching records from ${module}:`, error.message);
      throw new Error(`Failed to fetch records from ${module}: ${error.message}`);
    }
  }

  async getModuleFields(module: string, filterType?: 'file_attachment' | 'all'): Promise<SugarCRMField[]> {
    // Try real SugarCRM API first
    try {
      console.log(`[SugarCRM] Attempting to fetch fields for module: ${module} from ${this.tenant.sugarCrmUrl}`);
      await this.ensureAuthenticated();
      // Try different API endpoints for getting module fields
      const fieldEndpoints = [
        `/${module}`,  // Get records to infer field structure
        `/vardefs/${module}`,
        `/metadata`,
        `/${module}/attributes`
      ];
      
      let response;
      let lastError;
      
      for (const endpoint of fieldEndpoints) {
        try {
          console.log(`[SugarCRM] Making API call to: ${this.client.defaults.baseURL}${endpoint}`);
          response = await this.client.get(endpoint);
          console.log(`[SugarCRM] Successfully retrieved data from: ${endpoint}`);
          console.log(`[SugarCRM] Response keys:`, Object.keys(response.data));
          if (response.data.modules) {
            console.log(`[SugarCRM] Modules available:`, Object.keys(response.data.modules));
            if (response.data.modules[module]) {
              console.log(`[SugarCRM] ${module} module keys:`, Object.keys(response.data.modules[module]));
            }
          }
          break;
        } catch (error: any) {
          lastError = error;
          console.log(`[SugarCRM] Endpoint ${endpoint} failed: ${error.response?.data?.error_message || error.message}`);
        }
      }
      
      if (!response) {
        throw lastError;
      }
      // Parse response based on endpoint used
      let fields: any = {};
      if (response.data.fields) {
        // Standard fields endpoint
        fields = response.data.fields;
      } else if (response.data.modules && response.data.modules[module]) {
        // Metadata endpoint
        fields = response.data.modules[module].fields;
      } else if (response.data.records && Array.isArray(response.data.records) && response.data.records.length > 0) {
        // Record endpoint - extract field info from actual record
        const record = response.data.records[0];
        fields = {};
        Object.keys(record).forEach(key => {
          fields[key] = {
            name: key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: this.inferFieldType(record[key]),
            required: false
          };
        });
      } else if (response.data[module]) {
        // Direct module data
        fields = response.data[module];
      } else {
        // This is the SugarCRM metadata format - extract known field types
        console.log(`[SugarCRM] Parsing SugarCRM metadata format with ${Object.keys(response.data).length} field types`);
        console.log(`[SugarCRM] Detected metadata template format, using standard ${module} fields`);
        fields = {};
        
        // Create comprehensive Opportunity fields based on real SugarCRM structure
        if (module.toLowerCase() === 'opportunities') {
          fields = {
            id: { name: 'id', label: 'ID', type: 'id', required: true },
            name: { name: 'name', label: 'Opportunity Name', type: 'varchar', required: true },
            amount: { name: 'amount', label: 'Amount', type: 'currency', required: false },
            date_closed: { name: 'date_closed', label: 'Expected Close Date', type: 'date', required: false },
            sales_stage: { name: 'sales_stage', label: 'Sales Stage', type: 'enum', required: false },
            probability: { name: 'probability', label: 'Probability (%)', type: 'int', required: false },
            description: { name: 'description', label: 'Description', type: 'text', required: false },
            account_name: { name: 'account_name', label: 'Account Name', type: 'relate', required: false },
            account_id: { name: 'account_id', label: 'Account ID', type: 'id', required: false },
            assigned_user_name: { name: 'assigned_user_name', label: 'Assigned To', type: 'relate', required: false },
            assigned_user_id: { name: 'assigned_user_id', label: 'Assigned User ID', type: 'id', required: false },
            created_by_name: { name: 'created_by_name', label: 'Created By', type: 'relate', required: false },
            date_entered: { name: 'date_entered', label: 'Date Created', type: 'datetime', required: false },
            date_modified: { name: 'date_modified', label: 'Date Modified', type: 'datetime', required: false },
            // Additional standard SugarCRM Opportunity fields
            opportunity_type: { name: 'opportunity_type', label: 'Type', type: 'enum', required: false },
            lead_source: { name: 'lead_source', label: 'Lead Source', type: 'enum', required: false },
            campaign_name: { name: 'campaign_name', label: 'Campaign', type: 'relate', required: false },
            campaign_id: { name: 'campaign_id', label: 'Campaign ID', type: 'id', required: false },
            next_step: { name: 'next_step', label: 'Next Step', type: 'varchar', required: false },
            currency_id: { name: 'currency_id', label: 'Currency', type: 'id', required: false },
            base_rate: { name: 'base_rate', label: 'Base Rate', type: 'decimal', required: false },
            amount_usdollar: { name: 'amount_usdollar', label: 'Amount (USD)', type: 'currency', required: false },
            best_case: { name: 'best_case', label: 'Best Case', type: 'currency', required: false },
            worst_case: { name: 'worst_case', label: 'Worst Case', type: 'currency', required: false },
            commit_stage: { name: 'commit_stage', label: 'Commit Stage', type: 'enum', required: false },
            closed_timestamp: { name: 'closed_timestamp', label: 'Closed Timestamp', type: 'datetime', required: false },
            created_by: { name: 'created_by', label: 'Created By ID', type: 'id', required: false },
            modified_user_id: { name: 'modified_user_id', label: 'Modified By ID', type: 'id', required: false },
            modified_by_name: { name: 'modified_by_name', label: 'Modified By', type: 'relate', required: false },
            team_id: { name: 'team_id', label: 'Team ID', type: 'id', required: false },
            team_set_id: { name: 'team_set_id', label: 'Team Set ID', type: 'id', required: false },
            acl_team_set_id: { name: 'acl_team_set_id', label: 'ACL Team Set ID', type: 'id', required: false }
          };
        } else {
          // For other modules, create basic fields
          fields = {
            id: { name: 'id', label: 'ID', type: 'id', required: true },
            name: { name: 'name', label: 'Name', type: 'varchar', required: true },
            date_entered: { name: 'date_entered', label: 'Date Created', type: 'datetime', required: false },
            date_modified: { name: 'date_modified', label: 'Date Modified', type: 'datetime', required: false }
          };
        }
      }
      
      console.log(`[SugarCRM] Raw fields data structure:`, Object.keys(fields || {}).slice(0, 5));
      console.log(`[SugarCRM] Total fields found:`, Object.keys(fields || {}).length);
      console.log(`[SugarCRM] Sample field data:`, JSON.stringify(Object.values(fields || {})[0], null, 2));
      
      console.log(`[SugarCRM] About to process ${Object.keys(fields || {}).length} fields`);
      console.log(`[SugarCRM] First few field names:`, Object.keys(fields || {}).slice(0, 3));
      
      // Check if this is a template response (contains field types like 'currency', 'actionbutton')
      const fieldKeys = Object.keys(fields || {});
      const isTemplateResponse = fieldKeys.some(key => 
        ['currency', 'actionbutton', 'actiondropdown', 'actionmenu'].includes(key)
      );
      
      if (isTemplateResponse) {
        console.log(`[SugarCRM] Detected template response format, using comprehensive ${module} fields`);
        // Use our comprehensive hardcoded fields instead of trying to parse templates
        const comprehensiveOpportunityFields = [
          { name: 'id', label: 'ID', type: 'id', required: true },
          { name: 'name', label: 'Opportunity Name', type: 'varchar', required: true },
          { name: 'amount', label: 'Amount', type: 'currency', required: false },
          { name: 'date_closed', label: 'Expected Close Date', type: 'date', required: false },
          { name: 'sales_stage', label: 'Sales Stage', type: 'enum', required: false },
          { name: 'probability', label: 'Probability (%)', type: 'int', required: false },
          { name: 'description', label: 'Description', type: 'text', required: false },
          { name: 'account_name', label: 'Account Name', type: 'relate', required: false },
          { name: 'account_id', label: 'Account ID', type: 'id', required: false },
          { name: 'assigned_user_name', label: 'Assigned To', type: 'relate', required: false },
          { name: 'assigned_user_id', label: 'Assigned User ID', type: 'id', required: false },
          { name: 'created_by_name', label: 'Created By', type: 'relate', required: false },
          { name: 'date_entered', label: 'Date Created', type: 'datetime', required: false },
          { name: 'date_modified', label: 'Date Modified', type: 'datetime', required: false },
          // Additional standard SugarCRM Opportunity fields including requested ones
          { name: 'opportunity_type', label: 'Type', type: 'enum', required: false },
          { name: 'lead_source', label: 'Lead Source', type: 'enum', required: false },
          { name: 'campaign_name', label: 'Campaign', type: 'relate', required: false },
          { name: 'campaign_id', label: 'Campaign ID', type: 'id', required: false },
          { name: 'next_step', label: 'Next Step', type: 'varchar', required: false },
          { name: 'currency_id', label: 'Currency', type: 'id', required: false },
          { name: 'base_rate', label: 'Base Rate', type: 'decimal', required: false },
          { name: 'amount_usdollar', label: 'Amount (USD)', type: 'currency', required: false },
          { name: 'best_case', label: 'Best Case', type: 'currency', required: false },
          { name: 'worst_case', label: 'Worst Case', type: 'currency', required: false },
          { name: 'commit_stage', label: 'Commit Stage', type: 'enum', required: false },
          { name: 'closed_timestamp', label: 'Closed Timestamp', type: 'datetime', required: false },
          { name: 'created_by', label: 'Created By ID', type: 'id', required: false },
          { name: 'modified_user_id', label: 'Modified By ID', type: 'id', required: false },
          { name: 'modified_by_name', label: 'Modified By', type: 'relate', required: false },
          { name: 'team_id', label: 'Team ID', type: 'id', required: false },
          { name: 'team_set_id', label: 'Team Set ID', type: 'id', required: false },
          { name: 'acl_team_set_id', label: 'ACL Team Set ID', type: 'id', required: false }
        ];
        
        return module.toLowerCase() === 'opportunities' ? comprehensiveOpportunityFields : [
          { name: 'id', label: 'ID', type: 'id', required: true },
          { name: 'name', label: 'Name', type: 'varchar', required: true },
          { name: 'date_entered', label: 'Date Created', type: 'datetime', required: false },
          { name: 'date_modified', label: 'Date Modified', type: 'datetime', required: false }
        ];
      }
      
      let allFields = Object.values(fields || {}).map((field: any) => ({
        name: field.name || 'unknown',
        label: field.vname || field.label || field.name || 'Unknown Field',
        type: field.type || 'varchar',
        required: field.required || false,
      })).filter(field => field.name && field.name !== 'unknown');
      
      console.log(`[SugarCRM] After processing: ${allFields.length} valid fields`);

      // Filter for file attachment fields if requested
      if (filterType === 'file_attachment') {
        let fileFields = allFields.filter((field: SugarCRMField) => 
          ['file', 'image', 'upload', 'filename'].includes(field.type) ||
          field.name.includes('file') ||
          field.name.includes('attachment') ||
          field.name.includes('document') ||
          ['filename', 'file_attachment', 'document', 'attachment', 'upload_file'].includes(field.name)
        );

        // Always include 'filename' for Notes module
        if (module.toLowerCase() === 'notes' && !fileFields.find(f => f.name === 'filename')) {
          fileFields.unshift({
            name: 'filename',
            label: 'File Name',
            type: 'file',
            required: false
          });
        }

        // If no file fields found, provide common fallbacks
        if (fileFields.length === 0) {
          fileFields = [
            { name: 'filename', label: 'File Name', type: 'file', required: false },
            { name: 'file_attachment', label: 'File Attachment', type: 'file', required: false }
          ];
        }

        return fileFields;
      }

      return allFields;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        const retryResponse = await this.client.get(`/${module}/fields`);
        const fields = retryResponse.data.fields || retryResponse.data;
        let allFields = Object.values(fields).map((field: any) => ({
          name: field.name,
          label: field.vname || field.label || field.name,
          type: field.type,
          required: field.required || false,
        }));

        if (filterType === 'file_attachment') {
          let fileFields = allFields.filter((field: SugarCRMField) => 
            ['file', 'image', 'upload', 'filename'].includes(field.type) ||
            field.name.includes('file') ||
            field.name.includes('attachment') ||
            field.name.includes('document') ||
            ['filename', 'file_attachment', 'document', 'attachment', 'upload_file'].includes(field.name)
          );

          if (module.toLowerCase() === 'notes' && !fileFields.find(f => f.name === 'filename')) {
            fileFields.unshift({
              name: 'filename',
              label: 'File Name',
              type: 'file',
              required: false
            });
          }

          if (fileFields.length === 0) {
            fileFields = [
              { name: 'filename', label: 'File Name', type: 'file', required: false },
              { name: 'file_attachment', label: 'File Attachment', type: 'file', required: false }
            ];
          }

          return fileFields;
        }

        return allFields;
      }
      
      const errorMessage = error.response?.data?.error_message || error.message;
      console.warn(`[SugarCRM] API failed for ${module} fields: ${errorMessage}. Status: ${error.response?.status}. Falling back to mock data.`);
      
      // Fallback to mock data in development if API fails
      if (process.env.NODE_ENV === 'development') {
        const moduleKey = Object.keys(moduleSchemas).find(key => 
          key.toLowerCase() === module.toLowerCase()
        );
        if (moduleKey && moduleSchemas[moduleKey]) {
          console.log(`[API Fallback] Using mock schema for ${module} module`);
          let fields = moduleSchemas[moduleKey];
          
          // Filter for file attachment fields if requested
          if (filterType === 'file_attachment') {
            fields = fields.filter(field => 
              ['file', 'image', 'upload', 'filename'].includes(field.type) ||
              field.name.includes('file') ||
              field.name.includes('attachment') ||
              field.name.includes('document') ||
              ['filename', 'file_attachment', 'document', 'attachment', 'upload_file'].includes(field.name)
            );
            
            // Always include 'filename' for Notes module
            if (module.toLowerCase() === 'notes' && !fields.find(f => f.name === 'filename')) {
              fields.unshift({
                name: 'filename',
                label: 'File Name',
                type: 'file',
                required: false
              });
            }
          }
          
          return fields;
        }
      }
      
      // Return fallback fields for file attachments
      if (filterType === 'file_attachment') {
        console.error(`Failed to fetch fields for module ${module}:`, errorMessage);
        return [
          { name: 'filename', label: 'File Name', type: 'file', required: false },
          { name: 'file_attachment', label: 'File Attachment', type: 'file', required: false }
        ];
      }
      
      throw new Error(`Failed to fetch ${module} fields: ${errorMessage}`);
    }
  }

  // File attachment method for uploading PDFs to SugarCRM
  async createFileAttachment(params: {
    fileName: string;
    fileContent: Buffer;
    parentType: string;
    parentId: string;
    description?: string;
  }): Promise<any> {
    try {
      await this.ensureAuthenticated();
      
      // Convert buffer to base64
      const base64Content = params.fileContent.toString('base64');
      
      // Create Note with file attachment
      const noteData = {
        name: params.fileName,
        filename: params.fileName,
        file_mime_type: 'application/pdf',
        file: base64Content,
        parent_type: params.parentType,
        parent_id: params.parentId,
        description: params.description || `Document from PandaDoc: ${params.fileName}`,
      };
      
      console.log(`[SugarCRM] Creating file attachment: ${params.fileName} for ${params.parentType} ${params.parentId}`);
      
      const response = await this.client.post('/Notes', noteData);
      console.log(`[SugarCRM] Successfully created file attachment with ID: ${response.data.id}`);
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        // Retry the request
        const base64Content = params.fileContent.toString('base64');
        const noteData = {
          name: params.fileName,
          filename: params.fileName,
          file_mime_type: 'application/pdf',
          file: base64Content,
          parent_type: params.parentType,
          parent_id: params.parentId,
          description: params.description || `Document from PandaDoc: ${params.fileName}`,
        };
        
        const response = await this.client.post('/Notes', noteData);
        console.log(`[SugarCRM] Successfully created file attachment with ID: ${response.data.id}`);
        return response.data;
      }
      
      const errorMessage = error.response?.data?.error_message || error.message;
      console.error(`[SugarCRM] Failed to create file attachment: ${errorMessage}`);
      throw new Error(`Failed to create file attachment: ${errorMessage}`);
    }
  }

  private inferFieldType(value: any): string {
    if (value === null || value === undefined) return 'varchar';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'decimal';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'string') {
      // Check for date patterns
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date';
      if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) return 'datetime';
      if (value.includes('@')) return 'email';
      return 'varchar';
    }
    return 'text';
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

  async createNote(recordId: string, subject: string, description: string): Promise<any> {
    await this.ensureAuthenticated();
    
    const noteData = {
      name: subject,
      description: description,
      parent_type: 'Opportunities',
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
      tokens[key] = String(value || '');
    }
    
    return tokens;
  }
}