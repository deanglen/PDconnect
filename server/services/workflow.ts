import { Workflow, Tenant, WebhookLog } from '@shared/schema';
import { SugarCRMService } from './sugarcrm';
import { PandaDocService } from './pandadoc';
import { storage } from '../storage';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface WorkflowAction {
  type: 'update_sugarcrm' | 'attach_document' | 'send_notification' | 'log_activity' | 'create_note' | 'sync_fields';
  module?: string;
  field?: string;
  value?: any;
  recipients?: string[];
  subject?: string;
  message?: string;
  description?: string;
}

export interface WorkflowConfig {
  trigger: {
    event: string;
  };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export class WorkflowEngine {
  constructor(
    private tenant: Tenant,
    private sugarCrmService: SugarCRMService,
    private pandaDocService: PandaDocService
  ) {}

  async processWebhook(eventType: string, payload: any): Promise<WebhookLog> {
    const startTime = Date.now();
    let actionsTriggered = 0;
    let errorMessage: string | undefined;
    let status: 'success' | 'failed' | 'pending' = 'pending';
    const actionsDetails: any[] = [];

    // Create initial webhook log
    const webhookLog = await storage.createWebhookLog({
      tenantId: this.tenant.id,
      eventType,
      documentId: payload.data?.id,
      documentName: payload.data?.name,
      payload,
      status: 'pending',
      actionsTriggered: 0,
      maxRetries: 3,
      retryCount: 0,
    });

    try {
      // Get workflows for this event
      const workflows = await storage.getWorkflowsByEvent(this.tenant.id, eventType);

      for (const workflow of workflows) {
        try {
          // Handle IF/THEN/ELSE structure or simple actions
          const rules = workflow.ifThenElseRules as any;
          if (rules && rules.if) {
            const conditionsMet = this.evaluateIfConditions(rules.if, payload);
            
            if (conditionsMet && rules.then && Array.isArray(rules.then)) {
              for (const action of rules.then) {
                const actionResult = await this.executeActionWithTracking(action, payload, workflow.name);
                actionsDetails.push(actionResult);
                actionsTriggered++;
              }
            } else if (!conditionsMet && rules.else && Array.isArray(rules.else)) {
              for (const action of rules.else) {
                const actionResult = await this.executeActionWithTracking(action, payload, workflow.name);
                actionsDetails.push(actionResult);
                actionsTriggered++;
              }
            }
          } else if (workflow.actions && Array.isArray(workflow.actions)) {
            for (const action of workflow.actions) {
              const actionResult = await this.executeActionWithTracking(action, payload, workflow.name);
              actionsDetails.push(actionResult);
              actionsTriggered++;
            }
          }
        } catch (error) {
          console.error(`Error processing workflow ${workflow.id}:`, error);
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      status = 'success';
    } catch (error) {
      console.error('Error processing webhook:', error);
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      status = 'failed';
    }

    const processingTime = Date.now() - startTime;

    // Update webhook log with action details
    return await storage.updateWebhookLog(webhookLog.id, {
      status,
      actionsTriggered,
      errorMessage,
      processingTimeMs: processingTime,
      response: {
        status: status === 'success' ? 'success' : 'error',
        message: `Webhook processed successfully`,
        timestamp: new Date().toISOString(),
        actionsDetails: actionsDetails
      }
    });
  }

  private evaluateIfConditions(conditions: any[], payload: any): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(payload, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'not_contains':
          return !String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  private async executeActionWithTracking(action: WorkflowAction, payload: any, workflowName: string): Promise<any> {
    const actionStart = Date.now();
    let apiPayload: any = null;
    let apiResponse: any = null;
    let status = 'success';
    let message = '';
    let error: string | undefined;

    try {
      switch (action.type) {
        case 'update_sugarcrm':
          const updateResult = await this.updateSugarCRMRecordWithTracking(action, payload);
          apiPayload = updateResult.apiPayload;
          apiResponse = updateResult.apiResponse;
          message = updateResult.message;
          break;
        case 'attach_document':
          const attachResult = await this.attachDocumentToSugarCRMWithTracking(action, payload);
          apiPayload = attachResult.apiPayload;
          apiResponse = attachResult.apiResponse;
          message = attachResult.message;
          break;
        case 'create_note':
          const noteResult = await this.createSugarCRMNoteWithTracking(action, payload);
          apiPayload = noteResult.apiPayload;
          apiResponse = noteResult.apiResponse;
          message = noteResult.message;
          break;
        case 'sync_fields':
          const syncResult = await this.syncFieldsToSugarCRMWithTracking(action, payload);
          apiPayload = syncResult.apiPayload;
          apiResponse = syncResult.apiResponse;
          message = syncResult.message;
          break;
        case 'log_activity':
          await this.logActivity(action, payload);
          message = 'Activity logged successfully';
          break;
        case 'send_notification':
          await this.sendNotification(action, payload);
          message = 'Notification sent successfully';
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
          status = 'error';
          error = `Unknown action type: ${action.type}`;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error executing action ${action.type}:`, err);
    }

    const executionTime = Date.now() - actionStart;

    return {
      workflow: workflowName,
      condition: 'if_then',
      action: {
        type: action.type,
        details: action
      },
      result: {
        status,
        actionType: action.type,
        message,
        error,
        executionTimeMs: executionTime,
        apiPayload,
        apiResponse,
        timestamp: new Date().toISOString()
      }
    };
  }

  private async executeAction(action: WorkflowAction, payload: any): Promise<void> {
    switch (action.type) {
      case 'update_sugarcrm':
        await this.updateSugarCRMRecord(action, payload);
        break;
      case 'attach_document':
        await this.attachDocumentToSugarCRM(action, payload);
        break;
      case 'create_note':
        await this.createSugarCRMNote(action, payload);
        break;
      case 'sync_fields':
        await this.syncFieldsToSugarCRM(action, payload);
        break;
      case 'log_activity':
        await this.logActivity(action, payload);
        break;
      case 'send_notification':
        await this.sendNotification(action, payload);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async updateSugarCRMRecord(action: WorkflowAction, payload: any): Promise<void> {
    if (!action.module || !action.field) {
      throw new Error('Module and field are required for update_sugarcrm action');
    }

    // Get document from payload to find related Sugar record
    const document = await storage.getDocumentByPandaDocId(payload.data.id);
    if (!document || !document.sugarRecordId) {
      // Use metadata if document not found in storage
      const recordId = payload.data.metadata?.sugar_record_id;
      if (!recordId) {
        throw new Error('No related SugarCRM record found for document');
      }
      // Use the record ID from metadata
      const updateData = {
        [action.field]: this.interpolateValue(action.value, payload),
      };
      await this.sugarCrmService.updateRecord(action.module, recordId, updateData);
      return;
    }

    const updateData = {
      [action.field]: this.interpolateValue(action.value, payload),
    };

    await this.sugarCrmService.updateRecord(action.module, document.sugarRecordId, updateData);
  }

  private async attachDocumentToSugarCRM(action: WorkflowAction, payload: any): Promise<void> {
    // This would typically involve downloading the PDF from PandaDoc
    // and uploading it to SugarCRM as an attachment
    console.log('Attach document action not fully implemented');
  }

  private async createSugarCRMNote(action: WorkflowAction, payload: any): Promise<void> {
    if (!action.module || !action.subject) {
      throw new Error('Module and subject are required for create_note action');
    }

    const document = await storage.getDocument(payload.data.id);
    if (!document || !document.sugarRecordId) {
      throw new Error('No related SugarCRM record found for document');
    }

    const subject = this.interpolateValue(action.subject, payload);
    const description = action.message ? this.interpolateValue(action.message, payload) : undefined;

    await this.sugarCrmService.createNote(action.module, document.sugarRecordId, subject);
  }

  private async syncFieldsToSugarCRM(action: WorkflowAction, payload: any): Promise<void> {
    console.log('[FieldSync] Starting field synchronization process');
    
    // Extract document metadata to determine SugarCRM record
    const recordId = payload.data.metadata?.sugar_record_id;
    const sugarModule = payload.data.metadata?.sugar_module || 'Opportunities';
    
    if (!recordId) {
      throw new Error('No SugarCRM record ID found in document metadata');
    }

    console.log(`[FieldSync] Syncing to ${sugarModule} record: ${recordId}`);

    // Get field mappings for this tenant
    const fieldMappings = await storage.getFieldMappings(this.tenant.id);
    console.log(`[FieldSync] Found ${fieldMappings.length} field mappings`);

    if (fieldMappings.length === 0) {
      console.log('[FieldSync] No field mappings configured - skipping sync');
      return;
    }

    // Extract field values from PandaDoc webhook
    const documentFields = payload.data.fields || [];
    console.log(`[FieldSync] PandaDoc document has ${documentFields.length} fields`);

    // Create update data object
    const updateData: Record<string, any> = {};

    for (const mapping of fieldMappings) {
      // Skip inactive mappings
      if (!mapping.isActive) {
        continue;
      }

      // Clean the PandaDoc token to match field names
      const cleanToken = mapping.pandaDocToken
        .replace(/[\[\]]/g, '') // Remove brackets [field] -> field
        .replace(/[\{\}]/g, '') // Remove braces {{field}} -> field
        .toLowerCase();

      console.log(`[FieldSync] Looking for PandaDoc field "${cleanToken}" to map to Sugar field "${mapping.sugarField}"`);

      // Find matching field in PandaDoc document
      const matchingField = documentFields.find((field: any) => {
        const fieldName = (field.merge_field || field.name || '').toLowerCase();
        return fieldName === cleanToken || fieldName.includes(cleanToken);
      });

      if (matchingField && matchingField.value) {
        updateData[mapping.sugarField] = matchingField.value;
        console.log(`[FieldSync] Mapped "${cleanToken}" (${matchingField.value}) -> "${mapping.sugarField}"`);
      } else {
        console.log(`[FieldSync] No matching field found for "${cleanToken}"`);
      }
    }

    // Update SugarCRM record if we have data to update
    if (Object.keys(updateData).length > 0) {
      console.log(`[FieldSync] Updating SugarCRM with data:`, updateData);
      await this.sugarCrmService.updateRecord(sugarModule, recordId, updateData);
      console.log('[FieldSync] Successfully updated SugarCRM record');
    } else {
      console.log('[FieldSync] No field values to sync');
    }
  }

  // Tracking versions of action methods that capture API payloads/responses
  private async updateSugarCRMRecordWithTracking(action: WorkflowAction, payload: any): Promise<{apiPayload: any, apiResponse: any, message: string}> {
    if (!action.module || !action.field) {
      throw new Error('Module and field are required for update_sugarcrm action');
    }

    const recordId = payload.data.metadata?.sugar_record_id;
    if (!recordId) {
      throw new Error('No related SugarCRM record found for document');
    }

    const updateData = {
      [action.field]: this.interpolateValue(action.value, payload),
    };

    const response = await this.sugarCrmService.updateRecord(action.module, recordId, updateData);
    
    return {
      apiPayload: {
        module: action.module,
        recordId: recordId,
        updateData: updateData
      },
      apiResponse: response,
      message: `Updated ${action.module} record ${recordId}: ${action.field} = "${updateData[action.field]}"`
    };
  }

  private async syncFieldsToSugarCRMWithTracking(action: WorkflowAction, payload: any): Promise<{apiPayload: any, apiResponse: any, message: string}> {
    const recordId = payload.data.metadata?.sugar_record_id;
    const sugarModule = payload.data.metadata?.sugar_module || 'Opportunities';
    
    if (!recordId) {
      throw new Error('No SugarCRM record ID found in document metadata');
    }

    const fieldMappings = await storage.getFieldMappings(this.tenant.id);
    const documentFields = payload.data.fields || [];
    const updateData: Record<string, any> = {};

    for (const mapping of fieldMappings) {
      if (!mapping.isActive) continue;

      const cleanToken = mapping.pandaDocToken
        .replace(/[\[\]]/g, '')
        .replace(/[\{\}]/g, '')
        .toLowerCase();

      const matchingField = documentFields.find((field: any) => {
        const fieldName = (field.merge_field || field.name || '').toLowerCase();
        return fieldName === cleanToken || fieldName.includes(cleanToken);
      });

      if (matchingField && matchingField.value) {
        updateData[mapping.sugarField] = matchingField.value;
      }
    }

    let response = null;
    let message = '';

    if (Object.keys(updateData).length > 0) {
      response = await this.sugarCrmService.updateRecord(sugarModule, recordId, updateData);
      message = `Synced ${Object.keys(updateData).length} fields to ${sugarModule} record ${recordId}`;
    } else {
      message = 'No field values to sync';
    }

    return {
      apiPayload: {
        module: sugarModule,
        recordId: recordId,
        updateData: updateData,
        fieldMappingsCount: fieldMappings.length,
        documentFieldsCount: documentFields.length
      },
      apiResponse: response,
      message: message
    };
  }

  private async attachDocumentToSugarCRMWithTracking(action: WorkflowAction, payload: any): Promise<{apiPayload: any, apiResponse: any, message: string}> {
    return {
      apiPayload: {
        documentId: payload.data.id,
        documentName: payload.data.name,
        action: 'attach_document'
      },
      apiResponse: null,
      message: 'Document attachment not fully implemented'
    };
  }

  private async createSugarCRMNoteWithTracking(action: WorkflowAction, payload: any): Promise<{apiPayload: any, apiResponse: any, message: string}> {
    if (!action.module || !action.subject) {
      throw new Error('Module and subject are required for create_note action');
    }

    const recordId = payload.data.metadata?.sugar_record_id;
    if (!recordId) {
      throw new Error('No related SugarCRM record found for document');
    }

    const subject = this.interpolateValue(action.subject, payload);
    const description = action.message ? this.interpolateValue(action.message, payload) : undefined;

    const response = await this.sugarCrmService.createNote(action.module, recordId, subject);

    return {
      apiPayload: {
        module: action.module,
        recordId: recordId,
        subject: subject,
        description: description
      },
      apiResponse: response,
      message: `Created note "${subject}" for ${action.module} record ${recordId}`
    };
  }

  private async logActivity(action: WorkflowAction, payload: any): Promise<void> {
    // This would create an activity log entry in SugarCRM
    console.log('Log activity:', action.subject, payload);
  }

  private async sendNotification(action: WorkflowAction, payload: any): Promise<void> {
    // This would send email notifications - would need email service integration
    console.log('Send notification:', action.recipients, action.subject);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private interpolateValue(template: string, payload: any): string {
    if (typeof template !== 'string') {
      return String(template);
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(payload, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }
}
