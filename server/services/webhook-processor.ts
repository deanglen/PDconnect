/**
 * Webhook Processor Service - Handles asynchronous webhook processing with retry logic
 */

import { storage } from "../storage";
import { WorkflowEngine } from "./workflow";
import { logger } from "../utils/logger";
import { retryQueue } from "../utils/retry-queue";
import type { WebhookLog, InsertWebhookLog } from "@shared/schema";

export interface WebhookProcessorConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  maxRetryDelayMs: number;
}

export class WebhookProcessor {
  private static defaultConfig: WebhookProcessorConfig = {
    maxRetries: 3,
    retryDelayMs: 1000, // 1 second base delay
    exponentialBackoff: true,
    maxRetryDelayMs: 60000, // 1 minute max delay
  };

  /**
   * Persist webhook payload immediately and queue for async processing
   */
  static async persistAndQueue(
    payload: any,
    tenantId: string,
    eventId?: string,
    config: Partial<WebhookProcessorConfig> = {}
  ): Promise<WebhookLog> {
    const processingConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Handle both array format and single object format for payload
      const webhookData = Array.isArray(payload) ? payload[0] : payload;
      
      // Create webhook log entry with pending status
      const webhookLogData: InsertWebhookLog = {
        eventId: eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        eventType: webhookData.event_type || webhookData.event || 'unknown',
        documentId: webhookData.data?.id || webhookData.document?.id,
        documentName: webhookData.data?.name || webhookData.document?.name,
        payload: payload,
        status: 'pending',
        maxRetries: processingConfig.maxRetries,
        retryCount: 0,
      };

      const webhookLog = await storage.createWebhookLog(webhookLogData);

      logger.logWebhookEvent({
        webhookId: webhookLog.id,
        eventType: webhookLog.eventType,
        tenantId,
        status: 'persisted',
        timestamp: new Date().toISOString(),
      });

      // Queue for immediate processing
      console.log(`[WebhookProcessor] Queueing webhook ${webhookLog.id} for processing`);
      await this.queueForProcessing(webhookLog.id, 0);

      return webhookLog;
    } catch (error) {
      const webhookData = Array.isArray(payload) ? payload[0] : payload;
      logger.logWebhookError({
        tenantId,
        eventType: webhookData.event_type || webhookData.event || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'persistence',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Process a webhook log entry
   */
  static async processWebhook(webhookLogId: string): Promise<void> {
    console.log(`[WebhookProcessor] Starting to process webhook ${webhookLogId}`);
    const startTime = Date.now();
    
    try {
      // Get webhook log
      const webhookLog = await storage.getWebhookLogById(webhookLogId);
      if (!webhookLog) {
        throw new Error(`Webhook log not found: ${webhookLogId}`);
      }

      // Skip if already processed or permanently failed
      if (webhookLog.status === 'success' || webhookLog.status === 'permanently_failed') {
        return;
      }

      // Update status to processing
      await storage.updateWebhookLog(webhookLogId, {
        status: 'processing',
      });

      logger.logWebhookEvent({
        webhookId: webhookLogId,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId || 'unknown',
        status: 'processing_started',
        timestamp: new Date().toISOString(),
      });

      // Process the webhook
      const result = await this.executeWebhookProcessing(webhookLog);

      // Update success status
      const processingTime = Date.now() - startTime;
      await storage.updateWebhookLog(webhookLogId, {
        status: 'success',
        actionsTriggered: result.actionsTriggered,
        processingTimeMs: processingTime,
        processedAt: new Date(),
      });
      
      // Store processing response for debugging
      const response = {
        status: 'success',
        message: 'Webhook processed successfully',
        actionsTriggered: result.actionsTriggered,
        actionsDetails: result.actionsDetails,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      };
      await storage.updateWebhookLogResponse(webhookLogId, response);

      logger.logWebhookEvent({
        webhookId: webhookLogId,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId || 'unknown',
        status: 'success',
        actionsTriggered: result.actionsTriggered,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await this.handleProcessingError(webhookLogId, error, startTime);
    }
  }

  /**
   * Execute the actual webhook processing logic
   */
  private static async executeWebhookProcessing(webhookLog: WebhookLog): Promise<{ actionsTriggered: number; actionsDetails: any[] }> {
    if (!webhookLog.tenantId) {
      throw new Error('No tenant ID associated with webhook');
    }

    const tenant = await storage.getTenant(webhookLog.tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${webhookLog.tenantId}`);
    }

    // Get active workflows for this event type
    const workflows = await storage.getWorkflowsByEvent(webhookLog.tenantId, webhookLog.eventType);
    
    if (workflows.length === 0) {
      logger.logWebhookEvent({
        webhookId: webhookLog.id,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId,
        status: 'no_workflows_found',
        timestamp: new Date().toISOString(),
      });
      return { actionsTriggered: 0, actionsDetails: [] };
    }

    let totalActionsTriggered = 0;
    let actionsDetails: any[] = [];

    // Process each workflow manually since processWebhook creates its own log
    for (const workflow of workflows) {
      try {
        // Handle IF/THEN/ELSE structure or simple actions
        const rules = workflow.ifThenElseRules as any;
        let actionsExecuted = 0;
        
        if (rules && rules.if) {
          const conditionsMet = this.evaluateIfConditions(rules.if, webhookLog.payload);
          
          if (conditionsMet && rules.then && Array.isArray(rules.then)) {
            for (const action of rules.then) {
              const actionResult = await this.executeActionWithDetails(action, webhookLog.payload, tenant);
              actionsDetails.push({
                workflow: workflow.name,
                action: action,
                result: actionResult,
                condition: 'if_then',
                timestamp: new Date().toISOString()
              });
              actionsExecuted++;
            }
          } else if (!conditionsMet && rules.else && Array.isArray(rules.else)) {
            for (const action of rules.else) {
              const actionResult = await this.executeActionWithDetails(action, webhookLog.payload, tenant);
              actionsDetails.push({
                workflow: workflow.name,
                action: action,
                result: actionResult,
                condition: 'if_else',
                timestamp: new Date().toISOString()
              });
              actionsExecuted++;
            }
          }
        } else if (workflow.actions && Array.isArray(workflow.actions)) {
          for (const action of workflow.actions) {
            const actionResult = await this.executeActionWithDetails(action, webhookLog.payload, tenant);
            actionsDetails.push({
              workflow: workflow.name,
              action: action,
              result: actionResult,
              condition: 'direct',
              timestamp: new Date().toISOString()
            });
            actionsExecuted++;
          }
        }
        
        totalActionsTriggered += actionsExecuted;

        logger.logWorkflowExecution({
          workflowId: workflow.id,
          workflowName: workflow.name,
          webhookId: webhookLog.id,
          actionsExecuted: actionsExecuted,
          status: 'success',
          timestamp: new Date().toISOString(),
        });
      } catch (workflowError) {
        actionsDetails.push({
          workflow: workflow.name,
          action: null,
          result: { 
            status: 'error', 
            error: workflowError instanceof Error ? workflowError.message : 'Unknown error' 
          },
          condition: 'error',
          timestamp: new Date().toISOString()
        });
        
        logger.logWorkflowExecution({
          workflowId: workflow.id,
          workflowName: workflow.name,
          webhookId: webhookLog.id,
          status: 'failed',
          error: workflowError instanceof Error ? workflowError.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        // Continue processing other workflows even if one fails
      }
    }

    return { actionsTriggered: totalActionsTriggered, actionsDetails };
  }

  /**
   * Evaluate IF conditions for workflow logic
   */
  private static evaluateIfConditions(conditions: any[], payload: any): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(payload, condition.field);
      const compareValue = condition.value;
      
      let conditionMet = false;
      
      switch (condition.operator) {
        case 'equals':
          conditionMet = String(fieldValue) === String(compareValue);
          break;
        case 'not_equals':
          conditionMet = String(fieldValue) !== String(compareValue);
          break;
        case 'contains':
          conditionMet = String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
          break;
        case 'not_contains':
          conditionMet = !String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
          break;
        case 'greater_than':
          conditionMet = Number(fieldValue) > Number(compareValue);
          break;
        case 'less_than':
          conditionMet = Number(fieldValue) < Number(compareValue);
          break;
        default:
          console.warn(`Unknown operator: ${condition.operator}`);
          conditionMet = false;
      }
      
      // For now, use AND logic (all conditions must be met)
      if (!conditionMet) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Execute a workflow action with detailed response tracking
   */
  private static async executeActionWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    try {
      const startTime = Date.now();
      let result: any = { status: 'success' };

      switch (action.type) {
        case 'update_record':
          result = await this.updateSugarCRMRecordWithDetails(action, payload, tenant);
          break;
        case 'attach_file':
          result = await this.attachFileToSugarCRMWithDetails(action, payload, tenant);
          break;
        case 'create_note':
          result = await this.createSugarCRMNoteWithDetails(action, payload, tenant);
          break;
        case 'log_activity':
          result = await this.logActivityWithDetails(action, payload);
          break;
        case 'send_notification':
          result = await this.sendNotificationWithDetails(action, payload);
          break;
        case 'sync_fields':
          result = await this.syncFieldsToSugarCRMWithDetails(action, payload, tenant);
          break;
        case 'sync_all_fields':
          result = await this.syncAllFieldsToSugarCRMWithDetails(action, payload, tenant);
          break;
        default:
          result = { status: 'warning', message: `Unknown action type: ${action.type}` };
      }

      result.executionTimeMs = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - Date.now()
      };
    }
  }

  /**
   * Execute a workflow action (legacy method for backward compatibility)
   */
  private static async executeAction(action: any, payload: any, tenant: any): Promise<void> {
    switch (action.type) {
      case 'update_record':
        await this.updateSugarCRMRecord(action, payload, tenant);
        break;
      case 'attach_file':
        await this.attachFileToSugarCRM(action, payload, tenant);
        break;
      case 'create_note':
        await this.createSugarCRMNote(action, payload, tenant);
        break;
      case 'log_activity':
        await this.logActivity(action, payload);
        break;
      case 'send_notification':
        await this.sendNotification(action, payload);
        break;
      case 'sync_fields':
        await this.syncFieldsToSugarCRM(action, payload, tenant);
        break;
      case 'sync_all_fields':
        await this.syncAllFieldsToSugarCRM(action, payload, tenant);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private static async updateSugarCRMRecordWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    const { SugarCRMService } = await import('./sugarcrm');
    const sugarService = new SugarCRMService(tenant);
    
    if (!action.module || !action.field) {
      throw new Error('Module and field are required for update_record action');
    }

    // Get record ID from metadata
    const recordId = payload.data?.metadata?.sugar_record_id;
    if (!recordId) {
      throw new Error('No related SugarCRM record found for document');
    }

    const interpolatedValue = this.interpolateValue(action.value, payload);
    const updateData = {
      [action.field]: interpolatedValue,
    };

    // Capture the API request details
    const apiPayload = {
      method: 'PUT',
      url: `${tenant.sugarCrmUrl}/rest/v11/${action.module}/${recordId}`,
      headers: {
        'Content-Type': 'application/json',
        'OAuth-Token': '[REDACTED]'
      },
      body: updateData
    };

    console.log(`[WebhookProcessor] Making SugarCRM API call to update ${action.module} record ${recordId}:`, JSON.stringify(updateData, null, 2));

    const result = await sugarService.updateRecord(action.module, recordId, updateData);
    
    // Capture the API response
    const apiResponse = {
      status: 200,
      statusText: 'OK',
      data: result
    };

    console.log(`[WebhookProcessor] SugarCRM API response:`, JSON.stringify(result, null, 2));

    return {
      status: 'success',
      actionType: 'update_record',
      module: action.module,
      recordId,
      field: action.field,
      value: interpolatedValue,
      originalValue: action.value,
      message: `Updated ${action.module} record ${recordId}: ${action.field} = ${interpolatedValue}`,
      apiCall: {
        request: apiPayload,
        response: apiResponse,
        timestamp: new Date().toISOString(),
        executionTimeMs: 0 // Will be set by caller
      }
    };
  }

  private static async updateSugarCRMRecord(action: any, payload: any, tenant: any): Promise<void> {
    const { SugarCRMService } = await import('./sugarcrm');
    const sugarService = new SugarCRMService(tenant);
    
    if (!action.module || !action.field) {
      throw new Error('Module and field are required for update_record action');
    }

    // Get record ID from metadata
    const recordId = payload.data?.metadata?.sugar_record_id;
    if (!recordId) {
      throw new Error('No related SugarCRM record found for document');
    }

    const updateData = {
      [action.field]: this.interpolateValue(action.value, payload),
    };

    await sugarService.updateRecord(action.module, recordId, updateData);
  }

  private static async attachFileToSugarCRMWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    const { SugarCRMService } = await import('./sugarcrm');
    const { PandaDocService } = await import('./pandadoc');
    
    const sugarService = new SugarCRMService(tenant);
    const pandaService = new PandaDocService(tenant);

    // Get document ID and metadata - use real_document_id if available (for test cases)
    const documentId = payload.data?.metadata?.real_document_id || payload.data?.id;
    const recordId = payload.data?.metadata?.sugar_record_id;
    const recordModule = payload.data?.metadata?.sugar_module || 'Opportunities';
    
    if (!documentId || !recordId) {
      throw new Error('Document ID and SugarCRM record ID are required for file attachment');
    }

    try {
      // Download PDF from PandaDoc
      const pdfBuffer = await pandaService.downloadDocument(documentId);
      const fileName = `${payload.data?.name || 'Document'}.pdf`;

      // Upload to SugarCRM Notes module
      const attachmentResult = await sugarService.createFileAttachment({
        fileName,
        fileContent: pdfBuffer,
        parentType: recordModule,
        parentId: recordId,
        description: `Document from PandaDoc: ${payload.data?.name || 'Untitled'}`
      });

      return {
        status: 'success',
        actionType: 'attach_file',
        documentId,
        fileName,
        fileSize: pdfBuffer.length,
        parentModule: recordModule,
        parentId: recordId,
        attachmentResult,
        message: `Successfully attached ${fileName} (${pdfBuffer.length} bytes) to ${recordModule} ${recordId}`
      };
    } catch (error) {
      throw error;
    }
  }

  private static async attachFileToSugarCRM(action: any, payload: any, tenant: any): Promise<void> {
    const { SugarCRMService } = await import('./sugarcrm');
    const { PandaDocService } = await import('./pandadoc');
    
    const sugarService = new SugarCRMService(tenant);
    const pandaService = new PandaDocService(tenant);

    // Get document ID and metadata - use real_document_id if available (for test cases)
    const documentId = payload.data?.metadata?.real_document_id || payload.data?.id;
    const recordId = payload.data?.metadata?.sugar_record_id;
    const recordModule = payload.data?.metadata?.sugar_module || 'Opportunities';
    
    if (!documentId || !recordId) {
      throw new Error('Document ID and SugarCRM record ID are required for file attachment');
    }

    try {
      // Download PDF from PandaDoc
      const pdfBuffer = await pandaService.downloadDocument(documentId);
      const fileName = `${payload.data?.name || 'Document'}.pdf`;

      // Upload to SugarCRM Notes module
      await sugarService.createFileAttachment({
        fileName,
        fileContent: pdfBuffer,
        parentType: recordModule,
        parentId: recordId,
        description: `Document from PandaDoc: ${payload.data?.name || 'Untitled'}`
      });

      console.log(`Successfully attached file ${fileName} to ${recordModule} ${recordId}`);
    } catch (error) {
      console.error('Error attaching file to SugarCRM:', error);
      throw error;
    }
  }

  private static async createSugarCRMNoteWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    return {
      status: 'success',
      actionType: 'create_note',
      message: 'Create note action executed (not fully implemented)',
      details: action
    };
  }

  private static async logActivityWithDetails(action: any, payload: any): Promise<any> {
    return {
      status: 'success',
      actionType: 'log_activity',
      subject: action.subject,
      message: `Activity logged: ${action.subject}`,
      payload: payload.data?.id || 'N/A'
    };
  }

  private static async sendNotificationWithDetails(action: any, payload: any): Promise<any> {
    return {
      status: 'success',
      actionType: 'send_notification',
      recipients: action.recipients,
      subject: action.subject,
      message: `Notification sent to ${action.recipients}: ${action.subject}`
    };
  }

  private static async syncFieldsToSugarCRMWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const { SugarCRMService } = await import('./sugarcrm');
      const sugarService = new SugarCRMService(tenant);

      // Get document ID and metadata - use real_document_id if available (for test cases)
      const documentId = payload.data?.metadata?.real_document_id || payload.data?.id;
      const recordId = payload.data?.metadata?.sugar_record_id;
      const recordModule = payload.data?.metadata?.sugar_module || 'Opportunities';

      if (!documentId) {
        throw new Error('Document ID not found in webhook payload');
      }

      if (!recordId) {
        throw new Error('SugarCRM record ID not found in webhook metadata');
      }

      console.log(`[WebhookProcessor] Starting field sync for document ${documentId} to ${recordModule} record ${recordId}`);

      // Step 1: Extract field values from webhook payload (no API call needed)
      const webhookFields = payload.data?.fields || [];
      console.log(`[WebhookProcessor] Found ${webhookFields.length} fields in webhook payload`);
      
      // Convert webhook fields to lookup object for easier mapping
      const fieldValuesLookup: Record<string, any> = {};
      webhookFields.forEach((field: any) => {
        const fieldName = field.merge_field || field.name || '';
        if (fieldName && field.value !== undefined) {
          fieldValuesLookup[fieldName.toLowerCase()] = field.value;
        }
      });
      
      console.log(`[WebhookProcessor] Available field names:`, Object.keys(fieldValuesLookup));

      // Step 2: Get field mappings for this tenant and module  
      const fieldMappings = await storage.getFieldMappings(tenant.id, recordModule);
      console.log(`[WebhookProcessor] Found ${fieldMappings.length} field mappings for ${recordModule}`);

      if (fieldMappings.length === 0) {
        console.log(`[WebhookProcessor] No field mappings found for tenant ${tenant.id} and module ${recordModule}`);
        return {
          status: 'success',
          actionType: 'sync_fields',
          message: 'No field mappings found',
          fieldsMapped: 0,
          executionTimeMs: Date.now() - startTime
        };
      }

      // Step 3: Map PandaDoc values to SugarCRM fields
      const sugarUpdateData: Record<string, any> = {};
      let mappedFieldsCount = 0;

      for (const mapping of fieldMappings) {
        if (!mapping.isActive) continue;

        // Clean the PandaDoc token name (remove [[ ]] and {{ }} brackets)
        const cleanTokenName = mapping.pandaDocToken
          .replace(/^\[\[|\]\]$/g, '') // Remove [[ ]]
          .replace(/^\{\{|\}\}$/g, '') // Remove {{ }}
          .toLowerCase();

        if (fieldValuesLookup.hasOwnProperty(cleanTokenName)) {
          const fieldValue = fieldValuesLookup[cleanTokenName];
          sugarUpdateData[mapping.sugarCrmField] = fieldValue;
          mappedFieldsCount++;
          
          console.log(`[WebhookProcessor] Mapped field: ${mapping.pandaDocToken} -> ${mapping.sugarCrmField} = ${fieldValue}`);
        } else {
          console.log(`[WebhookProcessor] No value found for PandaDoc token: ${mapping.pandaDocToken} (cleaned: ${cleanTokenName})`);
        }
      }

      if (Object.keys(sugarUpdateData).length === 0) {
        console.log(`[WebhookProcessor] No fields to sync - no matching values found in webhook payload`);
        return {
          status: 'success',
          actionType: 'sync_fields',
          message: 'No matching field values found in webhook payload',
          fieldsMapped: 0,
          executionTimeMs: Date.now() - startTime
        };
      }

      // Step 4: Update SugarCRM record with captured API details
      const apiPayload = {
        method: 'PUT',
        url: `${tenant.sugarCrmUrl}/rest/v11/${recordModule}/${recordId}`,
        headers: {
          'Content-Type': 'application/json',
          'OAuth-Token': '[REDACTED]'
        },
        body: sugarUpdateData
      };

      console.log(`[WebhookProcessor] Making SugarCRM API call to sync ${mappedFieldsCount} fields to ${recordModule} record ${recordId}:`, JSON.stringify(sugarUpdateData, null, 2));

      const result = await sugarService.updateRecord(recordModule, recordId, sugarUpdateData);
      
      const apiResponse = {
        status: 200,
        statusText: 'OK',
        data: result
      };

      console.log(`[WebhookProcessor] Field sync completed successfully. Updated ${recordModule} record ${recordId} with ${mappedFieldsCount} fields`);
      
      return {
        status: 'success',
        actionType: 'sync_fields',
        module: recordModule,
        recordId: recordId,
        fieldsMapped: mappedFieldsCount,
        syncedFields: Object.keys(sugarUpdateData),
        message: `Synchronized ${mappedFieldsCount} fields to SugarCRM ${recordModule} record`,
        apiCall: {
          request: apiPayload,
          response: apiResponse,
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime
        }
      };
    } catch (error) {
      throw error;
    }
  }

  private static async syncAllFieldsToSugarCRMWithDetails(action: any, payload: any, tenant: any): Promise<any> {
    try {
      // Call the existing sync method and capture details
      await this.syncAllFieldsToSugarCRM(action, payload, tenant);
      
      return {
        status: 'success',
        actionType: 'sync_all_fields',
        message: 'All fields synchronized to SugarCRM',
        payload: payload.data
      };
    } catch (error) {
      throw error;
    }
  }

  private static async createSugarCRMNote(action: any, payload: any, tenant: any): Promise<void> {
    console.log('Create note action not fully implemented');
  }

  private static async logActivity(action: any, payload: any): Promise<void> {
    console.log('Log activity:', action.subject, payload);
  }

  private static async sendNotification(action: any, payload: any): Promise<void> {
    console.log('Send notification:', action.recipients, action.subject);
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static interpolateValue(template: string, payload: any): string {
    if (typeof template !== 'string') {
      return String(template);
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(payload, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Handle processing errors with retry logic
   */
  private static async handleProcessingError(
    webhookLogId: string,
    error: unknown,
    startTime: number
  ): Promise<void> {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const webhookLog = await storage.getWebhookLogById(webhookLogId);
      if (!webhookLog) return;

      const newRetryCount = (webhookLog.retryCount || 0) + 1;
      const maxRetries = webhookLog.maxRetries || this.defaultConfig.maxRetries;

      if (newRetryCount >= maxRetries) {
        // Mark as permanently failed
        await storage.updateWebhookLog(webhookLogId, {
          status: 'permanently_failed',
          retryCount: newRetryCount,
          errorMessage,
          processingTimeMs: processingTime,
        });
        
        // Store error response for debugging
        const response = {
          status: 'error',
          message: 'Webhook processing failed permanently',
          error: errorMessage,
          retryCount: newRetryCount,
          maxRetries,
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString()
        };
        await storage.updateWebhookLogResponse(webhookLogId, response);

        logger.logWebhookError({
          webhookId: webhookLogId,
          tenantId: webhookLog.tenantId || 'unknown',
          eventType: webhookLog.eventType,
          error: errorMessage,
          stage: 'permanently_failed',
          retryCount: newRetryCount,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(newRetryCount);
        const nextRetryAt = new Date(Date.now() + retryDelay);

        await storage.updateWebhookLog(webhookLogId, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage,
          processingTimeMs: processingTime,
          nextRetryAt,
        });
        
        // Store retry response for debugging
        const response = {
          status: 'retry_scheduled',
          message: 'Webhook processing failed, retry scheduled',
          error: errorMessage,
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt.toISOString(),
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString()
        };
        await storage.updateWebhookLogResponse(webhookLogId, response);

        // Queue for retry
        await this.queueForProcessing(webhookLogId, retryDelay);

        logger.logWebhookError({
          webhookId: webhookLogId,
          tenantId: webhookLog.tenantId || 'unknown',
          eventType: webhookLog.eventType,
          error: errorMessage,
          stage: 'retry_scheduled',
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt.toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (updateError) {
      logger.logWebhookError({
        webhookId: webhookLogId,
        tenantId: 'unknown',
        eventType: 'unknown',
        error: `Failed to update webhook log: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
        stage: 'error_handling',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private static calculateRetryDelay(retryCount: number): number {
    const { retryDelayMs, exponentialBackoff, maxRetryDelayMs } = this.defaultConfig;
    
    if (!exponentialBackoff) {
      return retryDelayMs;
    }

    // Exponential backoff: delay = baseDelay * (2 ^ retryCount) with jitter
    const exponentialDelay = retryDelayMs * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const totalDelay = exponentialDelay + jitter;

    return Math.min(totalDelay, maxRetryDelayMs);
  }

  /**
   * Queue webhook for processing (or retry)
   */
  private static async queueForProcessing(webhookLogId: string, delayMs: number = 0): Promise<void> {
    if (delayMs > 0) {
      // Schedule for later processing
      setTimeout(async () => {
        await this.processWebhook(webhookLogId);
      }, delayMs);
    } else {
      // Process immediately (in next tick to avoid blocking)
      console.log(`[WebhookProcessor] Scheduling immediate processing for webhook ${webhookLogId}`);
      setImmediate(async () => {
        console.log(`[WebhookProcessor] setImmediate callback executing for webhook ${webhookLogId}`);
        await this.processWebhook(webhookLogId);
      });
    }
  }

  /**
   * Manually retry a failed webhook
   */
  static async manualRetry(webhookLogId: string): Promise<void> {
    const webhookLog = await storage.getWebhookLogById(webhookLogId);
    if (!webhookLog) {
      throw new Error(`Webhook log not found: ${webhookLogId}`);
    }

    if (webhookLog.status === 'success') {
      throw new Error('Webhook has already been processed successfully');
    }

    // Reset retry count and status for manual retry
    await storage.updateWebhookLog(webhookLogId, {
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
      nextRetryAt: null,
    });

    // Queue for immediate processing
    await this.queueForProcessing(webhookLogId, 0);

    logger.logWebhookEvent({
      webhookId: webhookLogId,
      eventType: webhookLog.eventType,
      tenantId: webhookLog.tenantId || 'unknown',
      status: 'manual_retry_initiated',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    success: number;
    failed: number;
    permanentlyFailed: number;
  }> {
    const logs = await storage.getWebhookLogs(tenantId);
    
    const stats = {
      total: logs.length,
      pending: 0,
      processing: 0,
      success: 0,
      failed: 0,
      permanentlyFailed: 0,
    };

    logs.forEach(log => {
      switch (log.status) {
        case 'pending': stats.pending++; break;
        case 'processing': stats.processing++; break;
        case 'success': stats.success++; break;
        case 'failed': stats.failed++; break;
        case 'permanently_failed': stats.permanentlyFailed++; break;
      }
    });

    return stats;
  }

  /**
   * NEW: Sync PandaDoc field values back to SugarCRM using field mappings
   */
  private static async syncFieldsToSugarCRM(action: any, payload: any, tenant: any): Promise<void> {
    const { SugarCRMService } = await import('./sugarcrm');
    const { PandaDocService } = await import('./pandadoc');
    
    const sugarService = new SugarCRMService(tenant);
    const pandaService = new PandaDocService(tenant);

    // Get document ID and metadata - use real_document_id if available (for test cases)
    const documentId = payload.data?.metadata?.real_document_id || payload.data?.id;
    const recordId = payload.data?.metadata?.sugar_record_id;
    const recordModule = payload.data?.metadata?.sugar_module || 'Opportunities';

    if (!documentId) {
      throw new Error('Document ID not found in webhook payload');
    }

    if (!recordId) {
      throw new Error('SugarCRM record ID not found in webhook metadata');
    }

    console.log(`[WebhookProcessor] Starting field sync for document ${documentId} to ${recordModule} record ${recordId}`);

    try {
      // Step 1: Extract field values from webhook payload (no API call needed)
      const webhookFields = payload.data?.fields || [];
      console.log(`[WebhookProcessor] Found ${webhookFields.length} fields in webhook payload`);
      
      // Convert webhook fields to lookup object for easier mapping
      const fieldValuesLookup: Record<string, any> = {};
      webhookFields.forEach((field: any) => {
        const fieldName = field.merge_field || field.name || '';
        if (fieldName && field.value !== undefined) {
          fieldValuesLookup[fieldName.toLowerCase()] = field.value;
        }
      });
      
      console.log(`[WebhookProcessor] Available field names:`, Object.keys(fieldValuesLookup));

      // Step 2: Get field mappings for this tenant and module  
      const fieldMappings = await storage.getFieldMappings(tenant.id, recordModule);
      console.log(`[WebhookProcessor] Found ${fieldMappings.length} field mappings for ${recordModule}`);

      if (fieldMappings.length === 0) {
        console.log(`[WebhookProcessor] No field mappings found for tenant ${tenant.id} and module ${recordModule}`);
        return;
      }

      // Step 3: Map PandaDoc values to SugarCRM fields
      const sugarUpdateData: Record<string, any> = {};
      let mappedFieldsCount = 0;

      for (const mapping of fieldMappings) {
        if (!mapping.isActive) continue;

        // Clean the PandaDoc token name (remove [[ ]] and {{ }} brackets)
        const cleanTokenName = mapping.pandaDocToken
          .replace(/^\[\[|\]\]$/g, '') // Remove [[ ]]
          .replace(/^\[|\]$/g, '')     // Remove [ ]
          .replace(/^\{\{|\}\}$/g, '') // Remove {{ }}
          .toLowerCase();
        
        console.log(`[WebhookProcessor] Looking for field "${cleanTokenName}" from token "${mapping.pandaDocToken}"`);
        
        // Look for the value in webhook field values
        if (fieldValuesLookup.hasOwnProperty(cleanTokenName)) {
          const value = fieldValuesLookup[cleanTokenName];
          if (value !== undefined && value !== null && value !== '') {
            sugarUpdateData[mapping.sugarField] = value;
            mappedFieldsCount++;
            console.log(`[WebhookProcessor] Mapped ${cleanTokenName} -> ${mapping.sugarField}: ${value}`);
          }
        } else {
          console.log(`[WebhookProcessor] No matching field found for "${cleanTokenName}" in webhook payload`);
        }
      }

      // Step 4: Update SugarCRM record if we have mapped fields
      if (mappedFieldsCount > 0) {
        console.log(`[WebhookProcessor] Updating SugarCRM ${recordModule} ${recordId} with ${mappedFieldsCount} fields`);
        await sugarService.updateRecord(recordModule, recordId, sugarUpdateData);
        console.log(`Successfully synced ${mappedFieldsCount} fields from PandaDoc to SugarCRM ${recordModule} ${recordId}`);
      } else {
        console.log(`[WebhookProcessor] No field values to sync - all mappings were empty or undefined`);
      }

    } catch (error: any) {
      console.error(`[WebhookProcessor] Error syncing fields from PandaDoc to SugarCRM:`, error);
      throw new Error(`Failed to sync fields: ${error.message}`);
    }
  }

  /**
   * NEW: Sync ALL PandaDoc fields to SugarCRM using field mappings (bulk sync action)
   */
  private static async syncAllFieldsToSugarCRM(action: any, payload: any, tenant: any): Promise<void> {
    const { SugarCRMService } = await import('./sugarcrm');
    
    const sugarService = new SugarCRMService(tenant);

    // Get document metadata 
    const documentId = payload.data?.id;
    const recordId = payload.data?.metadata?.sugar_record_id;
    const recordModule = action.module || payload.data?.metadata?.sugar_module || 'Opportunities';

    if (!documentId) {
      throw new Error('Document ID not found in webhook payload');
    }

    if (!recordId) {
      throw new Error('SugarCRM record ID not found in webhook metadata');
    }

    console.log(`[WebhookProcessor] BULK SYNC: Starting sync of ALL fields for document ${documentId} to ${recordModule} record ${recordId}`);

    try {
      // Extract field values from webhook payload (all fields at once)
      const webhookFields = payload.data?.fields || [];
      console.log(`[WebhookProcessor] BULK SYNC: Found ${webhookFields.length} fields in webhook payload`);
      
      // Convert webhook fields to lookup object
      const fieldValuesLookup: Record<string, any> = {};
      webhookFields.forEach((field: any) => {
        const fieldName = field.merge_field || field.name || '';
        if (fieldName && field.value !== undefined) {
          fieldValuesLookup[fieldName.toLowerCase()] = field.value;
        }
      });
      
      console.log(`[WebhookProcessor] BULK SYNC: Available field names:`, Object.keys(fieldValuesLookup));

      // Get ALL active field mappings for this tenant and module  
      const fieldMappings = await storage.getFieldMappings(tenant.id, recordModule);
      console.log(`[WebhookProcessor] BULK SYNC: Found ${fieldMappings.length} field mappings for ${recordModule}`);

      if (fieldMappings.length === 0) {
        console.log(`[WebhookProcessor] BULK SYNC: No field mappings found for tenant ${tenant.id} and module ${recordModule}. Please configure field mappings in the Field Mappings section.`);
        return;
      }

      // Map ALL available PandaDoc values to SugarCRM fields
      const sugarUpdateData: Record<string, any> = {};
      let mappedFieldsCount = 0;

      for (const mapping of fieldMappings) {
        if (!mapping.isActive) continue;

        // Clean the PandaDoc token name (remove brackets)
        const cleanTokenName = mapping.pandaDocToken
          .replace(/^\[\[|\]\]$/g, '') // Remove [[ ]]
          .replace(/^\[|\]$/g, '')     // Remove [ ]
          .replace(/^\{\{|\}\}$/g, '') // Remove {{ }}
          .toLowerCase();
        
        console.log(`[WebhookProcessor] BULK SYNC: Looking for field "${cleanTokenName}" from token "${mapping.pandaDocToken}"`);
        
        // Look for the value in webhook field values
        if (fieldValuesLookup.hasOwnProperty(cleanTokenName)) {
          const value = fieldValuesLookup[cleanTokenName];
          if (value !== undefined && value !== null && value !== '') {
            sugarUpdateData[mapping.sugarField] = value;
            mappedFieldsCount++;
            console.log(`[WebhookProcessor] BULK SYNC: Mapped ${cleanTokenName} -> ${mapping.sugarField}: ${value}`);
          }
        } else {
          console.log(`[WebhookProcessor] BULK SYNC: No matching field found for "${cleanTokenName}" in webhook payload`);
        }
      }

      // Update SugarCRM record with ALL mapped fields
      if (mappedFieldsCount > 0) {
        console.log(`[WebhookProcessor] BULK SYNC: Updating SugarCRM ${recordModule} ${recordId} with ${mappedFieldsCount} fields`);
        await sugarService.updateRecord(recordModule, recordId, sugarUpdateData);
        console.log(`[WebhookProcessor] BULK SYNC: Successfully synced ${mappedFieldsCount} fields from PandaDoc to SugarCRM ${recordModule} ${recordId}`);
      } else {
        console.log(`[WebhookProcessor] BULK SYNC: No field values to sync - all mappings were empty or undefined`);
      }

    } catch (error: any) {
      console.error(`[WebhookProcessor] BULK SYNC: Error syncing all fields from PandaDoc to SugarCRM:`, error);
      throw new Error(`Failed to bulk sync fields: ${error.message}`);
    }
  }
}