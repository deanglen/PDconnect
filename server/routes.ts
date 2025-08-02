import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SugarCRMService } from "./services/sugarcrm";
import { PandaDocService, type SugarCRMDocumentRequest } from "./services/pandadoc";
import { WorkflowEngine } from "./services/workflow";
import { WebhookProcessor } from "./services/webhook-processor";
import { WebhookVerifier } from "./utils/webhook-verifier";
import { insertTenantSchema, insertFieldMappingSchema, insertWorkflowSchema, insertDocumentSchema, insertDocumentTemplateSchema, insertUserSchema, updateUserSchema } from "@shared/schema";
import { createAuthMiddleware, getAuthStatus } from "./middleware/multi-auth";
import { z } from "zod";
import { logger } from "./utils/logger";
import { retryQueue, initializeRetryQueue } from "./utils/retry-queue";

// Sample field data for demo purposes when SugarCRM is unavailable
function getSampleFieldsForModule(module: string) {
  const fieldsByModule: Record<string, any[]> = {
    opportunities: [
      { name: 'name', label: 'Opportunity Name', type: 'varchar', mapped: false },
      { name: 'amount', label: 'Amount', type: 'currency', mapped: false },
      { name: 'sales_stage', label: 'Sales Stage', type: 'enum', mapped: false },
      { name: 'account_name', label: 'Account Name', type: 'varchar', mapped: false },
      { name: 'assigned_user_name', label: 'Assigned To', type: 'varchar', mapped: false },
      { name: 'date_closed', label: 'Expected Close Date', type: 'date', mapped: false },
      { name: 'probability', label: 'Probability (%)', type: 'int', mapped: false },
      { name: 'description', label: 'Description', type: 'text', mapped: false },
    ],
    contacts: [
      { name: 'first_name', label: 'First Name', type: 'varchar', mapped: false },
      { name: 'last_name', label: 'Last Name', type: 'varchar', mapped: false },
      { name: 'email1', label: 'Email Address', type: 'email', mapped: false },
      { name: 'phone_mobile', label: 'Mobile Phone', type: 'phone', mapped: false },
      { name: 'phone_work', label: 'Office Phone', type: 'phone', mapped: false },
      { name: 'title', label: 'Title', type: 'varchar', mapped: false },
      { name: 'account_name', label: 'Account Name', type: 'varchar', mapped: false },
      { name: 'department', label: 'Department', type: 'varchar', mapped: false },
    ],
    accounts: [
      { name: 'name', label: 'Account Name', type: 'varchar', mapped: false },
      { name: 'phone_office', label: 'Office Phone', type: 'phone', mapped: false },
      { name: 'website', label: 'Website', type: 'url', mapped: false },
      { name: 'industry', label: 'Industry', type: 'enum', mapped: false },
      { name: 'employees', label: 'Employees', type: 'varchar', mapped: false },
      { name: 'annual_revenue', label: 'Annual Revenue', type: 'currency', mapped: false },
      { name: 'billing_address_street', label: 'Billing Street', type: 'varchar', mapped: false },
      { name: 'billing_address_city', label: 'Billing City', type: 'varchar', mapped: false },
    ],
  };

  return fieldsByModule[module] || [];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize retry queue processing
  initializeRetryQueue();

  // Multi-cloud authentication middleware - ONLY for API routes
  const authMiddleware = createAuthMiddleware();
  
  // Apply authentication to API routes only, not frontend routes
  // BUT exclude /api/users/me which handles its own authentication
  app.use('/api', (req, res, next) => {
    if (req.path === '/users/me') {
      return next(); // Skip auth middleware for user profile endpoint
    }
    return authMiddleware(req, res, next);
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    (req as any).requestId = requestId;
    
    const startTime = Date.now();
    
    // Log incoming request
    logger.logApiRequest({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString(),
      requestId
    });

    // Override res.json to log responses
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      
      logger.logApiResponse({
        status: res.statusCode,
        headers: res.getHeaders(),
        body,
        timestamp: new Date().toISOString(),
        requestId,
        duration
      });
      
      return originalJson(body);
    };

    next();
  });

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    const retryStats = retryQueue.getStats();
    
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      retryQueue: retryStats,
      auth: getAuthStatus()
    });
  });

  // Auth status endpoint  
  app.get("/auth-status", (req: Request, res: Response) => {
    res.json(getAuthStatus());
  });

  // Dashboard stats endpoint
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const tenants = await storage.getTenants();
      const activeTenants = tenants.filter(t => t.isActive);
      const recentLogs = await storage.getWebhookLogs();
      const successfulLogs = recentLogs.filter(l => l.status === 'processed');
      
      const stats = {
        documentsCreated: recentLogs.length,
        activeTenants: activeTenants.length,
        successRate: recentLogs.length > 0 ? (successfulLogs.length / recentLogs.length * 100).toFixed(1) : "0",
        webhookEvents: recentLogs.length,
        documentsGrowth: "12% from last month", // Mock data
        tenantsGrowth: "3 new this month", // Mock data
        successTrend: "Above target", // Mock data
        webhookRecent: "Updated 2 min ago" // Mock data
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Recent documents endpoint
  app.get("/api/documents/recent", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID required" });
      }

      const documents = await storage.getDocuments(tenantId);
      const recent = documents.slice(0, 10);
      
      res.json(recent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent documents" });
    }
  });

  // Create document endpoint
  app.post("/api/create-doc", async (req: Request, res: Response) => {
    try {
      const { tenantId, recordId, module, templateId } = req.body;

      if (!tenantId || !recordId || !module) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Initialize services
      const sugarService = new SugarCRMService(tenant);
      const pandaService = new PandaDocService(tenant);

      // Get SugarCRM record
      const record = await sugarService.getRecord(module, recordId);
      
      // Get field mappings for token generation
      const mappings = await storage.getFieldMappings(tenantId, module);
      
      // Generate tokens from record data and mappings
      const tokens = [];
      for (const mapping of mappings) {
        const value = record[mapping.sugarField];
        if (value !== undefined && value !== null) {
          tokens.push({
            name: mapping.pandaDocToken.replace(/[{}]/g, ''),
            value: String(value)
          });
        }
      }

      // Create PandaDoc document
      const createRequest = {
        name: `${record.name || 'Document'} - ${new Date().toLocaleDateString()}`,
        template_uuid: templateId || process.env.DEFAULT_TEMPLATE_ID || 'template-id-placeholder',
        recipients: [
          {
            email: record.email || 'recipient@example.com',
            first_name: record.first_name || 'Recipient',
            last_name: record.last_name || '',
            role: 'Signer',
          }
        ],
        tokens,
        metadata: {
          tenant_id: tenantId,
          sugar_record_id: recordId,
          sugar_module: module,
        }
      };

      const pandaDoc = await pandaService.createDocument(createRequest);

      // Save document record
      await storage.createDocument({
        tenantId,
        pandaDocId: pandaDoc.id,
        sugarRecordId: recordId,
        sugarModule: module,
        name: pandaDoc.name,
        status: pandaDoc.status,
        publicUrl: pandaService.generatePublicLink(pandaDoc.id),
      });

      res.json({
        documentId: pandaDoc.id,
        publicLink: pandaService.generatePublicLink(pandaDoc.id),
        status: pandaDoc.status,
      });

    } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create document" });
    }
  });

  // PandaDoc webhook endpoint - Enhanced with persistent storage and async processing
  app.post("/api/webhook/pandadoc", async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-pd-signature'] as string;
      const payload = JSON.stringify(req.body);

      // Validate webhook payload structure first
      if (!WebhookVerifier.validateWebhookPayload(req.body)) {
        return res.status(400).json({ message: "Invalid webhook payload structure" });
      }

      const eventType = req.body.event_type;
      const eventId = req.body.event_id || req.body.data?.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Check for duplicate webhook (using event_id for deduplication)
      const existingWebhook = await storage.getWebhookLogByEventId(eventId);
      if (existingWebhook) {
        logger.logWebhookEvent({
          webhookId: existingWebhook.id,
          eventType,
          tenantId: existingWebhook.tenantId || 'unknown',
          status: 'duplicate_ignored',
          timestamp: new Date().toISOString(),
        });
        return res.status(200).json({ message: "Webhook already processed", status: "duplicate" });
      }

      // Find tenant from document metadata
      const tenantId = WebhookVerifier.extractTenantFromPayload(req.body);
      if (!tenantId) {
        logger.logWebhookError({
          tenantId: 'unknown',
          eventType,
          error: 'Unable to identify tenant from webhook payload',
          stage: 'tenant_identification',
          timestamp: new Date().toISOString(),
        });
        return res.status(400).json({ message: "Unable to identify tenant" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        logger.logWebhookError({
          tenantId,
          eventType,
          error: `Tenant not found: ${tenantId}`,
          stage: 'tenant_validation',
          timestamp: new Date().toISOString(),
        });
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Verify webhook signature using tenant-specific secret
      if (tenant.webhookSharedSecret && signature) {
        if (!WebhookVerifier.verifyPandaDocSignature(payload, signature, tenant.webhookSharedSecret)) {
          logger.logWebhookError({
            tenantId,
            eventType,
            error: 'Invalid webhook signature',
            stage: 'signature_verification',
            timestamp: new Date().toISOString(),
          });
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
      }

      // PERSIST WEBHOOK IMMEDIATELY - This is the key requirement
      const webhookLog = await WebhookProcessor.persistAndQueue(req.body, tenantId, eventId);

      // Return 200 OK immediately after persistence (as required)
      res.status(200).json({ 
        message: "Webhook received and queued for processing", 
        webhookId: webhookLog.id,
        status: "queued" 
      });

      // Async processing is now handled by WebhookProcessor.persistAndQueue()
      // which queues the webhook for background processing

    } catch (error) {
      logger.logWebhookError({
        tenantId: 'unknown',
        eventType: req.body?.event_type || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'webhook_reception',
        timestamp: new Date().toISOString(),
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced webhook management endpoints for admin interface
  app.get("/api/webhook-logs", async (req: Request, res: Response) => {
    try {
      const { tenantId, status, eventType } = req.query;
      const logs = await storage.getWebhookLogs(
        tenantId as string, 
        status as string, 
        eventType as string
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch webhook logs" });
    }
  });

  // Manual retry endpoint for failed webhooks
  app.post("/api/webhook-logs/:id/retry", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await WebhookProcessor.manualRetry(id);
      res.json({ message: "Webhook retry initiated", webhookId: id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to retry webhook";
      res.status(500).json({ message });
    }
  });

  // Webhook processing statistics
  app.get("/api/webhook-stats", async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      const stats = await WebhookProcessor.getProcessingStats(tenantId as string);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch webhook statistics" });
    }
  });

  // Get failed webhooks for retry interface
  app.get("/api/webhook-logs/failed", async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      const failedLogs = await storage.getFailedWebhookLogs(tenantId as string);
      res.json(failedLogs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch failed webhooks" });
    }
  });

  // Get available tokens for a module
  app.get("/api/tokens", async (req: Request, res: Response) => {
    try {
      const { tenantId, module, recordId } = req.query;

      if (!tenantId || !module) {
        return res.status(400).json({ message: "Tenant ID and module are required" });
      }

      const tenant = await storage.getTenant(tenantId as string);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Get existing field mappings (fast database operation)
      const mappings = await storage.getFieldMappings(tenantId as string, module as string);
      
      // Return tokens based on existing mappings first for quick response
      const mappingTokens = mappings.map(mapping => ({
        name: mapping.sugarField,
        label: mapping.sugarFieldLabel,
        type: mapping.sugarFieldType,
        token: `{{${mapping.sugarField}}}`,
        mapped: true,
        pandaDocToken: mapping.pandaDocToken,
      }));

      // For performance, only return mapped fields for now
      // This prevents browser freezing with large field sets
      let additionalTokens: any[] = [];
      
      // Only fetch additional fields if there are few mappings (< 10)
      if (mappings.length < 10) {
        try {
          const sugarService = new SugarCRMService(tenant);
          
          // Set a very short timeout for the SugarCRM call
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SugarCRM API timeout')), 1500)
          );
          
          const fieldsPromise = sugarService.getModuleFields(module as string);
          const fields = await Promise.race([fieldsPromise, timeoutPromise]) as any[];
          
          // Add unmapped fields (limit to 20 to prevent browser freeze)
          additionalTokens = fields
            .filter(field => !mappings.some(m => m.sugarField === field.name))
            .slice(0, 20) // Very conservative limit
            .map(field => ({
              name: field.name,
              label: field.label,
              type: field.type,
              token: `{{${field.name}}}`,
              mapped: false,
              pandaDocToken: undefined,
            }));
        } catch (error) {
          console.warn('SugarCRM fields unavailable, using mappings only:', error);
        }
      }

      const allTokens = [...mappingTokens, ...additionalTokens];

      // Disable preview values for performance - causes browser freeze
      let previewValues = {};

      res.json({
        tokens: allTokens,
        previewValues,
      });

    } catch (error) {
      logger.error('Get tokens error', {
        tenantId: (req.query.tenantId as string) || 'unknown',
        requestId: (req as any).requestId
      }, error);
      
      // Always return existing mappings as fallback
      try {
        const mappings = await storage.getFieldMappings(req.query.tenantId as string, req.query.module as string);
        const fallbackTokens = mappings.map(mapping => ({
          name: mapping.sugarField,
          label: mapping.sugarFieldLabel,
          type: mapping.sugarFieldType,
          token: `{{${mapping.sugarField}}}`,
          mapped: true,
          pandaDocToken: mapping.pandaDocToken,
        }));
        
        res.json({
          tokens: fallbackTokens,
          previewValues: {},
          isDemo: true,
          message: 'Using existing field mappings - SugarCRM connection unavailable'
        });
      } catch (fallbackError) {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch tokens" });
      }
    }
  });

  // Tenant management endpoints
  // Admin dashboard route
  app.get("/admin", (req: Request, res: Response) => {
    res.json({ 
      message: "Admin access granted", 
      timestamp: new Date().toISOString(),
      auth: getAuthStatus()
    });
  });

  // User Management Endpoints
  // Get all users
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create new user
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = updateUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = await storage.updateUser(id, validatedData);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Generate new API key for user
  app.post("/api/users/:id/api-key", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const apiKey = await storage.generateApiKey(id);
      res.json({ apiKey, message: "New API key generated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate API key" });
    }
  });

  // Get user profile (for authenticated users) - NO ADMIN AUTH REQUIRED
  app.get("/api/users/me", async (req: Request, res: Response) => {
    try {
      // Extract API key from Authorization header
      const authHeader = req.headers.authorization;
      let apiKey = "";
      
      if (authHeader?.startsWith("Bearer ")) {
        apiKey = authHeader.substring(7);
      } else if (authHeader) {
        apiKey = authHeader;
      }

      if (!apiKey) {
        return res.status(401).json({ message: "API key required" });
      }

      // First check if it's the admin token
      if (apiKey === process.env.ADMIN_TOKEN || apiKey === 'demo-admin-token-2025') {
        return res.json({
          id: "admin",
          email: "admin@middleware.local",
          firstName: "System",
          lastName: "Administrator",
          role: "super_admin",
          isActive: true,
          tenantAccess: [],
          createdAt: new Date().toISOString(),
        });
      }

      // Then check if it's a user's personal API key
      const user = await storage.validateApiKey(apiKey);
      if (!user) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Tenants (protected by auth middleware)
  app.get("/api/tenants", async (req: Request, res: Response) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  // Generate tenant API key
  app.post("/api/tenants/:id/generate-api-key", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify tenant exists
      const tenant = await storage.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      // Generate new API key
      const apiKey = await storage.generateTenantApiKey(id);
      
      res.json({ 
        message: "Tenant API key generated successfully",
        apiKey,
        tenantId: id,
        usage: "Use this API key for SugarCRM integration. SugarCRM can authenticate using: Authorization: Bearer " + apiKey
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate tenant API key" });
    }
  });

  app.post("/api/tenants", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validatedData);
      res.status(201).json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  app.put("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(id, validatedData);
      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  app.delete("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteTenant(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Field mapping endpoints
  app.get("/api/field-mappings", async (req: Request, res: Response) => {
    try {
      const { tenantId, module } = req.query;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID required" });
      }
      
      const mappings = await storage.getFieldMappings(tenantId as string, module as string);
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch field mappings" });
    }
  });

  app.post("/api/field-mappings", async (req: Request, res: Response) => {
    try {
      const validatedData = insertFieldMappingSchema.parse(req.body);
      const mapping = await storage.createFieldMapping(validatedData);
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create field mapping" });
    }
  });

  app.delete("/api/field-mappings/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteFieldMapping(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete field mapping" });
    }
  });

  // Workflow management endpoints
  app.get("/api/workflows", async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID required" });
      }
      
      const workflows = await storage.getWorkflows(tenantId as string);
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/workflows", async (req: Request, res: Response) => {
    try {
      const validatedData = insertWorkflowSchema.parse(req.body);
      const workflow = await storage.createWorkflow(validatedData);
      res.status(201).json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  app.put("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertWorkflowSchema.partial().parse(req.body);
      const workflow = await storage.updateWorkflow(id, validatedData);
      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteWorkflow(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  // Webhook logs endpoint
  app.get("/api/webhook-logs", async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      const logs = await storage.getWebhookLogs(tenantId as string);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch webhook logs" });
    }
  });

  // Document creation endpoint - SugarCRM to PandaDoc
  app.post("/api/documents/create", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      
      // Extract tenant info from authentication (if using tenant API key)
      let tenantFromAuth: any = null;
      if ((req as any).authType === 'tenant_api_key' && (req as any).tenant) {
        tenantFromAuth = (req as any).tenant;
      }
      
      // Validate the request body
      const createDocumentRequest = z.object({
        tenantId: z.string().optional(), // Optional if using tenant API key
        sugarRecordId: z.string(),
        sugarModule: z.string(),
        templateId: z.string().optional(),
        name: z.string().optional(),
        recipients: z.array(z.object({
          email: z.string().email(),
          first_name: z.string(),
          last_name: z.string(),
          role: z.string(),
          signing_order: z.number().optional()
        })),
        tokens: z.array(z.object({
          name: z.string(),
          value: z.string()
        })).optional(),
        fields: z.record(z.object({
          value: z.string()
        })).optional(),
        tags: z.array(z.string()).optional(),
        sendImmediately: z.boolean().default(false),
        subject: z.string().optional(),
        message: z.string().optional()
      });

      const validatedData = createDocumentRequest.parse(req.body);
      
      // Determine tenant ID - prefer auth tenant over request body
      const tenantId = tenantFromAuth?.id || validatedData.tenantId;
      if (!tenantId) {
        return res.status(400).json({ 
          message: "Tenant ID required. Either provide tenantId in request or use tenant API key authentication." 
        });
      }
      
      // Get tenant information
      const tenant = tenantFromAuth || await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Initialize services
      const pandaDocService = new PandaDocService(tenant);
      const sugarCrmService = new SugarCRMService(tenant);

      // Get SugarCRM record data
      let sugarCrmData: Record<string, any> | undefined;
      try {
        sugarCrmData = await sugarCrmService.getRecord(validatedData.sugarModule, validatedData.sugarRecordId);
      } catch (error) {
        logger.error('Failed to fetch SugarCRM record', {}, error);
        // Continue without SugarCRM data - use provided data only
      }

      // Get template ID - use provided or get default for module
      let templateId = validatedData.templateId;
      if (!templateId) {
        // For now, require template ID to be provided
        // In the future, we could add default templates per module
        return res.status(400).json({ 
          message: "Template ID is required. Please configure a PandaDoc template for this request." 
        });
      }

      // Create the document using PandaDoc service
      const pandaDocRequest: SugarCRMDocumentRequest = {
        tenantId: tenant.id,
        sugarRecordId: validatedData.sugarRecordId,
        sugarModule: validatedData.sugarModule,
        templateId: templateId,
        name: validatedData.name,
        recipients: validatedData.recipients,
        tokens: validatedData.tokens,
        fields: validatedData.fields,
        tags: validatedData.tags,
        sendImmediately: validatedData.sendImmediately,
        subject: validatedData.subject,
        message: validatedData.message
      };

      const pandaDocResponse = await pandaDocService.createDocumentFromSugarCRM(
        pandaDocRequest,
        sugarCrmData
      );

      // Save document to database
      const documentData = {
        tenantId: tenant.id,
        pandaDocId: pandaDocResponse.id,
        sugarRecordId: validatedData.sugarRecordId,
        sugarModule: validatedData.sugarModule,
        name: pandaDocResponse.name,
        status: pandaDocResponse.status,
        publicUrl: pandaDocResponse.publicUrl
      };

      const savedDocument = await storage.createDocument(documentData);

      logger.info('Document created successfully', {
        tenantId: tenant.id,
        requestId
      }, {
        documentId: pandaDocResponse.id,
        sugarModule: validatedData.sugarModule,
        sugarRecordId: validatedData.sugarRecordId
      });

      res.status(201).json({
        document: savedDocument,
        pandaDocResponse,
        sugarCrmData: sugarCrmData ? { 
          found: true, 
          recordName: sugarCrmData.name || `${sugarCrmData.first_name || ''} ${sugarCrmData.last_name || ''}`.trim()
        } : { found: false }
      });

    } catch (error: any) {
      const requestId = (req as any).requestId;
      
      if (error instanceof z.ZodError) {
        logger.error('Document creation validation failed', { requestId }, error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }

      logger.error('Document creation failed', { requestId }, error);
      
      // Add to retry queue if it's a recoverable error
      if (error.message.includes('timeout') || error.message.includes('rate limit')) {
        try {
          retryQueue.addJob(req.body.tenantId || 'unknown', 'create_document', req.body, 3);
          
          res.status(202).json({ 
            message: "Document creation queued for retry due to temporary error",
            error: error.message
          });
        } catch (queueError) {
          res.status(500).json({ 
            message: "Failed to create document and queue for retry",
            error: error.message
          });
        }
      } else {
        res.status(500).json({ 
          message: "Failed to create document",
          error: error.message
        });
      }
    }
  });

  // Get documents for a tenant
  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID required" });
      }
      
      const documents = await storage.getDocuments(tenantId as string);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Document Template Management Routes

  // Get all document templates for a tenant
  app.get("/api/document-templates", async (req: Request, res: Response) => {
    try {
      const { tenantId, module } = req.query;
      
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const templates = await storage.getDocumentTemplates(tenantId as string, module as string);
      res.json(templates);
    } catch (error: any) {
      const requestId = (req as any).requestId;
      logger.error('Failed to fetch document templates', { requestId }, error);
      res.status(500).json({ message: "Failed to fetch document templates", error: error.message });
    }
  });

  // Get specific document template
  app.get("/api/document-templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await storage.getDocumentTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Document template not found" });
      }
      
      res.json(template);
    } catch (error: any) {
      const requestId = (req as any).requestId;
      logger.error('Failed to fetch document template', { requestId }, error);
      res.status(500).json({ message: "Failed to fetch document template", error: error.message });
    }
  });

  // Create document template
  app.post("/api/document-templates", async (req: Request, res: Response) => {
    try {
      const validatedTemplate = insertDocumentTemplateSchema.parse(req.body);
      const newTemplate = await storage.createDocumentTemplate(validatedTemplate);
      
      const requestId = (req as any).requestId;
      logger.info('Document template created', { requestId }, {
        templateId: newTemplate.id,
        tenantId: newTemplate.tenantId,
        name: newTemplate.name
      });
      
      res.status(201).json(newTemplate);
    } catch (error: any) {
      const requestId = (req as any).requestId;
      
      if (error instanceof z.ZodError) {
        logger.error('Document template validation failed', { requestId }, error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }

      logger.error('Failed to create document template', { requestId }, error);
      res.status(500).json({ message: "Failed to create document template", error: error.message });
    }
  });

  // Update document template
  app.put("/api/document-templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertDocumentTemplateSchema.partial().parse(req.body);
      
      const updatedTemplate = await storage.updateDocumentTemplate(id, validatedData);
      
      const requestId = (req as any).requestId;
      logger.info('Document template updated', { requestId }, {
        templateId: updatedTemplate.id,
        tenantId: updatedTemplate.tenantId
      });
      
      res.json(updatedTemplate);
    } catch (error: any) {
      const requestId = (req as any).requestId;
      
      if (error instanceof z.ZodError) {
        logger.error('Document template update validation failed', { requestId }, error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }

      logger.error('Failed to update document template', { requestId }, error);
      res.status(500).json({ message: "Failed to update document template", error: error.message });
    }
  });

  // Delete document template
  app.delete("/api/document-templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteDocumentTemplate(id);
      
      const requestId = (req as any).requestId;
      logger.info('Document template deleted', { requestId }, { templateId: id });
      
      res.status(204).send();
    } catch (error: any) {
      const requestId = (req as any).requestId;
      logger.error('Failed to delete document template', { requestId }, error);
      res.status(500).json({ message: "Failed to delete document template", error: error.message });
    }
  });

  // MAIN INTEGRATION ENDPOINT: Create document from SugarCRM record
  app.post("/create-doc", async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;
    
    try {
      // Validate required parameters
      const { record_id, module, tenant_id, template_id } = req.body;
      
      if (!record_id || !module || !tenant_id || !template_id) {
        logger.error('Missing required parameters for document creation', { requestId }, {
          record_id: !!record_id,
          module: !!module, 
          tenant_id: !!tenant_id,
          template_id: !!template_id
        });
        
        return res.status(400).json({
          error: "Missing required parameters",
          required: ["record_id", "module", "tenant_id", "template_id"],
          message: "Please provide record_id, module, tenant_id, and template_id"
        });
      }

      logger.info('Document creation request received', { requestId }, {
        record_id,
        module,
        tenant_id,
        template_id
      });

      // 1. Get tenant configuration
      const tenant = await storage.getTenant(tenant_id);
      if (!tenant) {
        logger.error('Tenant not found', { requestId }, { tenant_id });
        return res.status(404).json({
          error: "Tenant not found",
          message: `No tenant found with ID: ${tenant_id}`
        });
      }

      if (!tenant.isActive) {
        logger.error('Tenant is inactive', { requestId }, { tenant_id });
        return res.status(403).json({
          error: "Tenant inactive",
          message: "This tenant configuration is currently inactive"
        });
      }

      // 2. Fetch SugarCRM record data
      logger.info('Fetching SugarCRM record data', { requestId }, { record_id, module });
      
      const sugarCrmService = new SugarCRMService(tenant);

      const recordData = await sugarCrmService.getRecord(module, record_id);
      if (!recordData) {
        logger.error('SugarCRM record not found', { requestId }, { record_id, module });
        return res.status(404).json({
          error: "Record not found",
          message: `No ${module} record found with ID: ${record_id}`
        });
      }

      logger.info('SugarCRM record data retrieved', { requestId }, {
        record_id,
        module,
        fieldCount: Object.keys(recordData).length
      });

      // 3. Load field mapping configuration for this tenant and module
      const fieldMappings = await storage.getFieldMappings(tenant_id, module);
      
      logger.info('Retrieved field mappings', { requestId }, {
        tenant_id,
        module,
        mappingCount: fieldMappings.length
      });

      // 4. Resolve mapped values dynamically from SugarCRM record
      const tokens: Array<{ name: string; value: string }> = [];
      
      for (const mapping of fieldMappings) {
        if (!mapping.isActive) continue;
        
        // Get value from SugarCRM record (support for nested/related records could be added here)
        const fieldValue = recordData[mapping.sugarField];
        
        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
          // Extract token name from PandaDoc token (remove {{ }} brackets)
          const tokenName = mapping.pandaDocToken.replace(/[{}]/g, '').trim();
          
          tokens.push({
            name: tokenName,
            value: String(fieldValue)
          });
          
          logger.debug('Mapped field to token', { requestId }, {
            sugarField: mapping.sugarField,
            pandaDocToken: mapping.pandaDocToken,
            tokenName,
            hasValue: !!fieldValue
          });
        }
      }

      // Add standard metadata tokens (always include these)
      tokens.push({ name: 'sugar_record_id', value: record_id });
      tokens.push({ name: 'sugar_module', value: module });
      tokens.push({ name: 'creation_date', value: new Date().toISOString().split('T')[0] });
      tokens.push({ name: 'tenant_id', value: tenant_id });

      logger.info('Generated PandaDoc tokens from field mappings', { requestId }, {
        tokenCount: tokens.length,
        mappedFields: fieldMappings.filter(m => m.isActive).length,
        sampleTokens: tokens.slice(0, 5).map(t => t.name)
      });

      // 4. Get recipients from SugarCRM record or use defaults
      const recipients = [];
      
      // Try to extract email from common SugarCRM email fields
      const emailFields = ['email1', 'email', 'email_address', 'primary_email'];
      let emailValue = null;
      for (const field of emailFields) {
        if (recordData[field]) {
          emailValue = recordData[field];
          break;
        }
      }
      
      if (emailValue) {
        recipients.push({
          email: emailValue,
          first_name: recordData.first_name || recordData.name || "Recipient",
          last_name: recordData.last_name || "",
          role: "signer"
        });
      } else {
        // Use a default recipient - could be configured per tenant
        recipients.push({
          email: "demo@example.com",
          first_name: "Demo",
          last_name: "Recipient", 
          role: "signer"
        });
      }

      // 5. Create document via PandaDoc API
      const pandaDocService = new PandaDocService(tenant);

      const documentRequest = {
        name: `${module} - ${recordData.name || recordData.first_name || record_id}`,
        template_uuid: template_id,
        recipients,
        tokens,
        metadata: {
          sugar_record_id: record_id,
          sugar_module: module,
          tenant_id: tenant_id,
          created_via: "middleware_api"
        }
      };

      logger.info('Creating PandaDoc document', { requestId }, {
        template_id,
        recipientCount: recipients.length,
        tokenCount: Object.keys(tokens).length
      });

      const pandaDocResponse = await pandaDocService.createDocument(documentRequest);

      // 6. Store document record
      const documentRecord = {
        tenantId: tenant_id,
        pandaDocId: pandaDocResponse.id,
        sugarRecordId: record_id,
        sugarModule: module,
        name: documentRequest.name,
        status: pandaDocResponse.status,
        publicUrl: null, // Will be updated when document is completed
        downloadUrl: null // Will be updated when document is completed
      };

      const savedDocument = await storage.createDocument(documentRecord);

      logger.info('Document created successfully', { requestId }, {
        documentId: pandaDocResponse.id,
        sugarRecordId: record_id,
        module,
        status: pandaDocResponse.status
      });

      // 7. Return document information to SugarCRM
      const response = {
        success: true,
        document: {
          id: pandaDocResponse.id,
          name: documentRequest.name,
          status: pandaDocResponse.status,
          public_url: null, // Available after document is completed
          download_url: null, // Available after document is completed
          created_date: new Date().toISOString()
        },
        sugar_crm: {
          record_id,
          module
        },
        metadata: {
          tenant_id,
          template_id,
          token_count: Object.keys(tokens).length,
          recipient_count: recipients.length
        }
      };

      res.status(201).json(response);

    } catch (error: any) {
      logger.error('Document creation failed', { requestId }, error);
      
      // Add to retry queue for failed operations
      if (req.body.record_id && req.body.module && req.body.tenant_id) {
        retryQueue.addJob(req.body.tenant_id || 'unknown', 'create_document', {
          record_id: req.body.record_id,
          module: req.body.module,
          tenant_id: req.body.tenant_id,
          template_id: req.body.template_id,
          timestamp: new Date().toISOString(),
          error_message: error.message
        }, 3);
      }

      res.status(500).json({
        error: "Document creation failed",
        message: error.message,
        record_id: req.body.record_id,
        module: req.body.module,
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
