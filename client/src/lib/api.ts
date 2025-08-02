import { apiRequest } from "./queryClient";

export interface DashboardStats {
  documentsCreated: number;
  activeTenants: number;
  successRate: string;
  webhookEvents: number;
  documentsGrowth: string;
  tenantsGrowth: string;
  successTrend: string;
  webhookRecent: string;
}

export interface TokenInfo {
  name: string;
  label: string;
  type: string;
  token: string;
  mapped: boolean;
  pandaDocToken?: string;
}

export interface TokenResponse {
  tokens: TokenInfo[];
  previewValues: Record<string, string>;
}

export const api = {
  // Dashboard
  async getStats(): Promise<DashboardStats> {
    return await apiRequest("/api/stats");
  },

  async getRecentDocuments(tenantId: string) {
    return await apiRequest(`/api/documents/recent?tenantId=${tenantId}`);
  },

  // Document creation
  async createDocument(data: {
    tenantId: string;
    recordId: string;
    module: string;
    templateId?: string;
  }) {
    return await apiRequest("/api/create-doc", "POST", data);
  },

  // Tokens
  async getTokens(tenantId: string, module: string, recordId?: string): Promise<TokenResponse> {
    const params = new URLSearchParams({ tenantId, module });
    if (recordId) params.append('recordId', recordId);
    
    return await apiRequest(`/api/tokens?${params}`);
  },

  // Field Discovery 
  async discoverFields(tenantId: string, module: string, recordId?: string) {
    const params = new URLSearchParams({ tenantId });
    if (recordId) params.append('recordId', recordId);
    
    return await apiRequest(`/api/sugarcrm/${module}/fields?${params}`);
  },

  // Test Mapping
  async testMapping(data: {
    tenantId: string;
    recordId: string;
    module: string;
    mappings?: any[];
  }) {
    return await apiRequest("/api/test-mapping", "POST", data);
  },

  // Tenants
  async getTenants() {
    return await apiRequest("/api/tenants");
  },

  async createTenant(data: any) {
    return await apiRequest("/api/tenants", "POST", data);
  },

  async updateTenant(id: string, data: any) {
    return await apiRequest(`/api/tenants/${id}`, "PUT", data);
  },

  async deleteTenant(id: string) {
    await apiRequest(`/api/tenants/${id}`, "DELETE");
    return true;
  },

  async generateTenantApiKey(tenantId: string) {
    return await apiRequest(`/api/tenants/${tenantId}/generate-api-key`, "POST");
  },

  // Field mappings
  async getFieldMappings(tenantId: string, module?: string) {
    const params = new URLSearchParams({ tenantId });
    if (module) params.append('module', module);
    
    return await apiRequest(`/api/field-mappings?${params}`);
  },

  async createFieldMapping(data: any) {
    return await apiRequest("/api/field-mappings", "POST", data);
  },

  async deleteFieldMapping(id: string) {
    await apiRequest(`/api/field-mappings/${id}`, "DELETE");
    return true;
  },

  // Workflows
  async getWorkflows(tenantId: string) {
    return await apiRequest(`/api/workflows?tenantId=${tenantId}`);
  },

  async createWorkflow(data: any) {
    return await apiRequest("/api/workflows", "POST", data);
  },

  async updateWorkflow(id: string, data: any) {
    return await apiRequest(`/api/workflows/${id}`, "PUT", data);
  },

  async deleteWorkflow(id: string) {
    await apiRequest(`/api/workflows/${id}`, "DELETE");
    return true;
  },

  // Webhook logs
  async getWebhookLogs(tenantId?: string) {
    const params = tenantId ? `?tenantId=${tenantId}` : '';
    return await apiRequest(`/api/webhook-logs${params}`);
  },
};
