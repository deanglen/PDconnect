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
    const res = await apiRequest("GET", "/api/stats");
    return res.json();
  },

  async getRecentDocuments(tenantId: string) {
    const res = await apiRequest("GET", `/api/documents/recent?tenantId=${tenantId}`);
    return res.json();
  },

  // Document creation
  async createDocument(data: {
    tenantId: string;
    recordId: string;
    module: string;
    templateId?: string;
  }) {
    const res = await apiRequest("POST", "/api/create-doc", data);
    return res.json();
  },

  // Tokens
  async getTokens(tenantId: string, module: string, recordId?: string): Promise<TokenResponse> {
    const params = new URLSearchParams({ tenantId, module });
    if (recordId) params.append('recordId', recordId);
    
    const res = await apiRequest("GET", `/api/tokens?${params}`);
    return res.json();
  },

  // Tenants
  async getTenants() {
    const res = await apiRequest("GET", "/api/tenants");
    return res.json();
  },

  async createTenant(data: any) {
    const res = await apiRequest("POST", "/api/tenants", data);
    return res.json();
  },

  async updateTenant(id: string, data: any) {
    const res = await apiRequest("PUT", `/api/tenants/${id}`, data);
    return res.json();
  },

  async deleteTenant(id: string) {
    const res = await apiRequest("DELETE", `/api/tenants/${id}`);
    return res.status === 204;
  },

  // Field mappings
  async getFieldMappings(tenantId: string, module?: string) {
    const params = new URLSearchParams({ tenantId });
    if (module) params.append('module', module);
    
    const res = await apiRequest("GET", `/api/field-mappings?${params}`);
    return res.json();
  },

  async createFieldMapping(data: any) {
    const res = await apiRequest("POST", "/api/field-mappings", data);
    return res.json();
  },

  async deleteFieldMapping(id: string) {
    const res = await apiRequest("DELETE", `/api/field-mappings/${id}`);
    return res.status === 204;
  },

  // Workflows
  async getWorkflows(tenantId: string) {
    const res = await apiRequest("GET", `/api/workflows?tenantId=${tenantId}`);
    return res.json();
  },

  async createWorkflow(data: any) {
    const res = await apiRequest("POST", "/api/workflows", data);
    return res.json();
  },

  async updateWorkflow(id: string, data: any) {
    const res = await apiRequest("PUT", `/api/workflows/${id}`, data);
    return res.json();
  },

  async deleteWorkflow(id: string) {
    const res = await apiRequest("DELETE", `/api/workflows/${id}`);
    return res.status === 204;
  },

  // Webhook logs
  async getWebhookLogs(tenantId?: string) {
    const params = tenantId ? `?tenantId=${tenantId}` : '';
    const res = await apiRequest("GET", `/api/webhook-logs${params}`);
    return res.json();
  },
};
